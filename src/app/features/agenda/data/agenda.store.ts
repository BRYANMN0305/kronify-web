import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppointmentControllerService } from '../../../core/api/openapi/api/appointmentController.service';
import { EmployeeControllerService } from '../../../core/api/openapi/api/employeeController.service';
import { PublicBusinessControllerService } from '../../../core/api/openapi/api/publicBusinessController.service';
import { ServiceControllerService } from '../../../core/api/openapi/api/serviceController.service';
import type { AppointmentResponse } from '../../../core/api/openapi/model/appointmentResponse';
import type { AppointmentStatusUpdateRequest } from '../../../core/api/openapi/model/appointmentStatusUpdateRequest';
import type { DayAvailabilityResponse } from '../../../core/api/openapi/model/dayAvailabilityResponse';
import type { EmployeeResponse } from '../../../core/api/openapi/model/employeeResponse';
import type { ServiceResponse } from '../../../core/api/openapi/model/serviceResponse';
import { AuthStore, apiErrorMessage } from '../../../core/auth/auth.store';
import { Permissions } from '../../../core/auth/permissions';
import { SessionExpiredError } from '../../../core/api/jwt.interceptor';
import { DatetimeService } from '../../../core/datetime/datetime.service';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';

/** Estado técnico que acepta la agenda como filtro (se envía tal cual al backend). */
export type AgendaFilterStatus = NonNullable<AppointmentResponse['status']>;

/** Filtros combinables de la agenda del negocio. */
export interface AgendaFilters {
  readonly employeeId: number | null;
  readonly serviceId: number | null;
  readonly status: AgendaFilterStatus | null;
}

const EMPTY_FILTERS: AgendaFilters = { employeeId: null, serviceId: null, status: null };

/**
 * Fuente única de la agenda. Traduce las respuestas del API al modelo que consume
 * la vista; todo sale del API real, sin datos de ejemplo en ningún caso.
 */
@Injectable({ providedIn: 'root' })
export class AgendaStore {
  private readonly api = inject(AppointmentControllerService);
  private readonly servicesApi = inject(ServiceControllerService);
  private readonly employeesApi = inject(EmployeeControllerService);
  private readonly publicApi = inject(PublicBusinessControllerService);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(Permissions);
  private readonly datetime = inject(DatetimeService);
  private readonly appointmentsState = signal<readonly Appointment[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly filtersState = signal<AgendaFilters>(EMPTY_FILTERS);
  private readonly employeesState = signal<readonly EmployeeResponse[]>([]);
  private readonly servicesState = signal<readonly ServiceResponse[]>([]);
  private readonly filterOptionsLoadingState = signal(false);
  private readonly rangeState = signal<{ startDate: string; endDate: string } | null>(null);
  private servicesRequest: Promise<readonly ServiceResponse[]> | null = null;
  private employeesRequest: Promise<readonly EmployeeResponse[]> | null = null;
  private servicesLoaded = false;
  private lastSessionUserId: string | null = null;

  constructor() {
    // Cambio de sesión → el catálogo y los filtros son del negocio anterior: se descartan.
    // Igual que BusinessStore, se observa el usuario y no el token para que refrescar
    // los claims del mismo usuario no borre el estado ya cargado.
    effect(() => {
      const userId = this.auth.user()?.sub ?? null;
      if (userId === this.lastSessionUserId) return;
      this.lastSessionUserId = userId;
      this.resetSessionData();
    });
  }

  readonly appointments = this.appointmentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly filters = this.filtersState.asReadonly();
  readonly employees = this.employeesState.asReadonly();
  readonly services = this.servicesState.asReadonly();
  readonly filterOptionsLoading = this.filterOptionsLoadingState.asReadonly();
  readonly appointmentCount = computed(() => this.appointmentsState().length);
  readonly confirmedCount = computed(
    () => this.countByStatus('Confirmada'),
  );
  readonly pendingCount = computed(
    () => this.countByStatus('Pendiente'),
  );
  readonly completedCount = computed(
    () => this.countByStatus('Completada'),
  );
  readonly cancelledCount = computed(
    () => this.countByStatus('Cancelada'),
  );
  readonly hasActiveFilters = computed(() => {
    const filters = this.filtersState();
    return filters.employeeId != null || filters.serviceId != null || filters.status != null;
  });

  /** Catálogo y equipo para los selectores de la barra de filtros. */
  async loadFilterOptions(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    // El backend reserva la lista del equipo y el catálogo al dueño del negocio.
    // Un empleado solo consulta su propia agenda, así que no hay opciones que cargar.
    if (!this.permissions.isOwner()) return;
    this.filterOptionsLoadingState.set(true);
    try {
      await Promise.all([this.fetchEmployees(), this.fetchServices()]);
    } finally {
      this.filterOptionsLoadingState.set(false);
    }
  }

  /** Aplica filtros parciales y recarga el rango visible con los valores del servidor. */
  setFilters(partial: Partial<AgendaFilters>): void {
    const next: AgendaFilters = { ...this.filtersState(), ...partial };
    if (next.employeeId === this.filtersState().employeeId
      && next.serviceId === this.filtersState().serviceId
      && next.status === this.filtersState().status) return;
    this.filtersState.set(next);
    this.reloadRange();
  }

  clearFilters(): void {
    if (!this.hasActiveFilters()) return;
    this.filtersState.set(EMPTY_FILTERS);
    this.reloadRange();
  }

  reloadRange(): void {
    const range = this.rangeState();
    if (range) void this.loadRange(range.startDate, range.endDate);
  }

  async loadRange(startDate: string, endDate: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      // Sin sesión la agenda queda vacía (el guard redirige al login).
      this.appointmentsState.set([]);
      this.loadingState.set(false);
      return;
    }

    this.rangeState.set({ startDate, endDate });
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      // El catálogo solo lo puede leer el dueño; el nombre y la duración ya vienen
      // en cada cita, así que un empleado no necesita esta petición.
      if (this.permissions.isOwner()) await this.ensureServices();
      const filters = this.filtersState();
      const appointments = await firstValueFrom(this.api.getAgenda(
        startDate,
        endDate,
        filters.employeeId ?? undefined,
        filters.serviceId ?? undefined,
        filters.status ?? undefined,
      ));
      this.appointmentsState.set(appointments.map((appointment) => this.fromApi(appointment)));
    } catch (error) {
      this.appointmentsState.set([]);
      this.errorState.set(error instanceof SessionExpiredError
        ? 'Tu sesión expiró. Vuelve a iniciar sesión para ver tu agenda.'
        : 'No se pudo cargar la agenda del servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async loadToday(): Promise<void> {
    const start = this.datetime.now().startOf('day');
    // The API accepts inclusive LocalDate values, not UTC timestamps.
    await this.loadRange(start.format('YYYY-MM-DD'), start.format('YYYY-MM-DD'));
  }

  /**
   * Cambia el estado de una cita. Devuelve `false` cuando la operación no se
   * aplicó, para que la vista pueda mantener abierto el detalle y mostrar el motivo.
   */
  async updateStatus(id: number, status: AppointmentStatus): Promise<boolean> {
    const appointment = this.appointmentsState().find((item) => item.id === id);
    if (!appointment) return false;
    this.errorState.set(null);

    // Refuerzo local de la regla del backend: una cita que ya empezó no se confirma.
    // Al servidor no se envía nada para no depender de la latencia de la red.
    if (status === 'Confirmada' && this.datetime.hasPassed(appointment.startAt)) {
      this.errorState.set('No se puede confirmar una cita que ya pasó. Reprográmala para un horario futuro.');
      return false;
    }

    const apiStatus: AppointmentStatusUpdateRequest['status'] = {
      Confirmada: 'CONFIRMED', Pendiente: 'PENDING', Completada: 'COMPLETED',
      Cancelada: 'CANCELLED', 'No asistió': 'NO_SHOW',
    }[status] as AppointmentStatusUpdateRequest['status'];
    try {
      const updated = await firstValueFrom(this.api.updateAppointmentStatus(id, { status: apiStatus }));
      this.replaceOne(this.fromApi(updated));
      // Con un filtro de estado activo, una cita que cambia de estado puede dejar de pertenecer a la lista.
      if (this.filtersState().status && this.filtersState().status !== updated.status) this.reloadRange();
      return true;
    } catch (error) {
      this.errorState.set(apiErrorMessage(error));
      return false;
    }
  }

  /** Reprograma una cita desde la agenda del negocio usando el endpoint dedicado. */
  async reschedule(appointmentId: number, startAt: string): Promise<Appointment | null> {
    try {
      const updated = await firstValueFrom(this.api.rescheduleAppointment(appointmentId, { startAt }));
      this.replaceOne(this.fromApi(updated));
      this.reloadRange();
      return this.appointmentsState().find((item) => item.id === appointmentId) ?? null;
    } catch {
      this.errorState.set('No se pudo reprogramar la cita. Verifica el horario e inténtalo de nuevo.');
      return null;
    }
  }

  /** Disponibilidad de un servicio en una fecha, opcionalmente acotada a un empleado. */
  async availability(serviceId: number, date: string, employeeId?: number): Promise<DayAvailabilityResponse> {
    let businessId = this.auth.user()?.businessId;
    if (businessId == null) {
      // El JWT de un negocio recién creado no siempre incluye el claim; se reemite una vez.
      try {
        await this.auth.refreshSession();
      } catch {
        throw new Error('La sesión no tiene un negocio asociado para consultar disponibilidad.');
      }
      businessId = this.auth.user()?.businessId;
    }
    if (businessId == null) {
      throw new Error('La sesión no tiene un negocio asociado para consultar disponibilidad.');
    }
    return firstValueFrom(this.publicApi.getAvailability(String(businessId), serviceId, date, employeeId));
  }

  /** Inserta una cita recibida por SSE si pertenece al rango y a los filtros activos. */
  ingest(response: AppointmentResponse): void {
    const appointment = this.fromApi(response);
    const range = this.rangeState();
    if (!range || !appointment.dateKey) return;
    if (appointment.dateKey < range.startDate || appointment.dateKey > range.endDate) return;

    const filters = this.filtersState();
    if (filters.employeeId != null && response.employeeId !== filters.employeeId) return;
    if (filters.serviceId != null && response.serviceId !== filters.serviceId) return;
    if (filters.status != null && response.status !== filters.status) return;

    this.appointmentsState.update((appointments) => [
      ...appointments.filter((item) => item.id !== appointment.id),
      appointment,
    ].sort((left, right) => `${left.dateKey ?? ''}${left.time}`.localeCompare(`${right.dateKey ?? ''}${right.time}`)));
  }

  private replaceOne(updated: Appointment): void {
    this.appointmentsState.update((appointments) =>
      appointments.map((appointment) => (appointment.id === updated.id ? updated : appointment)));
  }

  /** Limpia catálogo, filtros y rango al cambiar de sesión (logout u otra cuenta). */
  private resetSessionData(): void {
    this.appointmentsState.set([]);
    this.errorState.set(null);
    this.filtersState.set(EMPTY_FILTERS);
    this.employeesState.set([]);
    this.servicesState.set([]);
    this.servicesRequest = null;
    this.employeesRequest = null;
    this.servicesLoaded = false;
    this.rangeState.set(null);
  }

  private async ensureServices(): Promise<void> {
    if (this.servicesLoaded) return;
    // El calendario sigue funcionando sin precios ni descripciones si el catálogo falla.
    await this.fetchServices();
  }

  /**
   * Petición compartida del catálogo: loadFilterOptions y loadRange pueden llegar a la
   * vez (carga inicial, foco de vuelta a la pestaña) y no deben duplicar la llamada.
   * Si falla se libera para permitir el reintento en la siguiente carga.
   */
  private fetchServices(): Promise<readonly ServiceResponse[]> {
    this.servicesRequest ??= firstValueFrom(this.servicesApi.listServices())
      .then((services) => {
        this.servicesState.set(services ?? []);
        this.servicesLoaded = true;
        return this.servicesState();
      })
      .catch(() => {
        this.servicesRequest = null;
        return [] as readonly ServiceResponse[];
      });
    return this.servicesRequest;
  }

  private fetchEmployees(): Promise<readonly EmployeeResponse[]> {
    this.employeesRequest ??= firstValueFrom(this.employeesApi.listEmployees())
      .then((employees) => {
        this.employeesState.set(employees ?? []);
        return this.employeesState();
      })
      .catch(() => {
        this.employeesRequest = null;
        return [] as readonly EmployeeResponse[];
      });
    return this.employeesRequest;
  }

  private countByStatus(status: AppointmentStatus): number {
    return this.appointmentsState().filter((appointment) => appointment.status === status).length;
  }

  private fromApi(appointment: AppointmentResponse): Appointment {
    const startsAt = appointment.startAt ? this.datetime.fromLocal(appointment.startAt) : this.datetime.now();
    const endsAt = appointment.endAt ? this.datetime.fromLocal(appointment.endAt) : null;
    const statusByApi: Record<NonNullable<AppointmentResponse['status']>, AppointmentStatus> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmada', COMPLETED: 'Completada',
      CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
    };
    const status = statusByApi[appointment.status ?? 'PENDING'];
    const service = this.servicesState().find((item) => item.id === appointment.serviceId);
    return {
      id: appointment.appointmentId ?? 0,
      businessId: appointment.businessId,
      serviceId: appointment.serviceId,
      employeeId: appointment.employeeId,
      client: appointment.customerName ?? 'Cliente',
      phone: appointment.customerPhone,
      email: appointment.customerEmail,
      service: appointment.serviceName ?? 'Servicio',
      description: service?.description,
      employee: appointment.employeeName ?? 'Por asignar',
      time: startsAt.format('HH:mm'),
      endTime: endsAt?.format('HH:mm'),
      dateKey: startsAt.format('YYYY-MM-DD'),
      startAt: appointment.startAt,
      durationMinutes: appointment.serviceDurationMinutes ?? 0,
      price: service?.price,
      status,
      origin: appointment.origin,
    };
  }
}

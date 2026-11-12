import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppointmentControllerService } from '../../../core/api/openapi/api/appointmentController.service';
import { ServiceControllerService } from '../../../core/api/openapi/api/serviceController.service';
import type { AppointmentResponse } from '../../../core/api/openapi/model/appointmentResponse';
import type { AppointmentStatusUpdateRequest } from '../../../core/api/openapi/model/appointmentStatusUpdateRequest';
import { AuthStore } from '../../../core/auth/auth.store';
import { DatetimeService } from '../../../core/datetime/datetime.service';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';
import { SAMPLE_APPOINTMENTS } from '../datos/appointments.data';

/**
 * Fuente única de la agenda. Traduce las respuestas del API al modelo que consume la vista
 * y conserva el modo demo para que la ruta pública nunca dependa de una sesión.
 *
 * Fuera del modo demo TODO sale del API: no se rellenan citas de ejemplo cuando una
 * petición falla, para que las métricas del calendario siempre reflejen datos reales.
 */
@Injectable({ providedIn: 'root' })
export class AgendaStore {
  private readonly api = inject(AppointmentControllerService);
  private readonly servicesApi = inject(ServiceControllerService);
  private readonly auth = inject(AuthStore);
  private readonly datetime = inject(DatetimeService);
  private readonly appointmentsState = signal<readonly Appointment[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly demoState = signal(true);
  readonly appointments = this.appointmentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isDemo = this.demoState.asReadonly();
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

  loadDemo(): void {
    this.appointmentsState.set(SAMPLE_APPOINTMENTS);
    this.loadingState.set(false);
    this.errorState.set(null);
    this.demoState.set(true);
  }

  async loadRange(startDate: string, endDate: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.loadDemo();
      return;
    }

    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [appointments, services] = await Promise.all([
        firstValueFrom(this.api.getAgenda(startDate, endDate)),
        firstValueFrom(this.servicesApi.listServices()).catch(() => []),
      ]);
      const serviceDetails = new Map(services.map((service) => [service.id, { price: service.price, description: service.description }]));
      this.appointmentsState.set(appointments.map((appointment) => this.fromApi(appointment, serviceDetails)));
      this.demoState.set(false);
    } catch {
      // Sin datos de ejemplo: el calendario debe reflejar solo lo que responde la API.
      this.appointmentsState.set([]);
      this.demoState.set(false);
      this.errorState.set('No se pudo cargar la agenda del servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async loadToday(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.demoState.set(true);
      return;
    }

    const start = this.datetime.now().startOf('day');
    // The API accepts inclusive LocalDate values, not UTC timestamps.
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [appointments, services] = await Promise.all([
        firstValueFrom(this.api.getAgenda(start.format('YYYY-MM-DD'), start.format('YYYY-MM-DD'))),
        firstValueFrom(this.servicesApi.listServices()).catch(() => []),
      ]);
      const serviceDetails = new Map(services.map((service) => [service.id, { price: service.price, description: service.description }]));
      this.appointmentsState.set(appointments.map((appointment) => this.fromApi(appointment, serviceDetails)));
      this.demoState.set(false);
    } catch {
      this.appointmentsState.set([]);
      this.demoState.set(false);
      this.errorState.set('No se pudo cargar la agenda del servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async updateStatus(id: number, status: AppointmentStatus): Promise<void> {
    const appointment = this.appointmentsState().find((item) => item.id === id);
    if (!appointment) return;

    if (!this.demoState()) {
      const apiStatus: AppointmentStatusUpdateRequest['status'] = {
        Confirmada: 'CONFIRMED', Pendiente: 'PENDING', Completada: 'COMPLETED', Cancelada: 'CANCELLED',
      }[status] as AppointmentStatusUpdateRequest['status'];
      try {
        await firstValueFrom(this.api.updateAppointmentStatus(id, { status: apiStatus }));
      } catch {
        this.errorState.set('No se pudo actualizar el estado en el servidor. Intenta de nuevo.');
        return;
      }
    }

    this.appointmentsState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status } : appointment,
      ),
    );
  }

  private countByStatus(status: AppointmentStatus): number {
    return this.appointmentsState().filter((appointment) => appointment.status === status).length;
  }

  private fromApi(appointment: AppointmentResponse, services: ReadonlyMap<number | undefined, { price?: number; description?: string }>): Appointment {
    const startsAt = appointment.startAt ? this.datetime.fromLocal(appointment.startAt) : this.datetime.now();
    const endsAt = appointment.endAt ? this.datetime.fromLocal(appointment.endAt) : null;
    const statusByApi: Record<NonNullable<AppointmentResponse['status']>, AppointmentStatus> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmada', COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'Cancelada',
    };
    const status = statusByApi[appointment.status ?? 'PENDING'];
    return {
      id: appointment.appointmentId ?? 0,
      client: appointment.customerName ?? 'Cliente',
      phone: appointment.customerPhone,
      email: appointment.customerEmail,
      service: appointment.serviceName ?? 'Servicio',
      description: services.get(appointment.serviceId)?.description,
      employee: appointment.employeeName ?? 'Por asignar',
      time: startsAt.format('HH:mm'),
      endTime: endsAt?.format('HH:mm'),
      dateKey: startsAt.format('YYYY-MM-DD'),
      durationMinutes: appointment.serviceDurationMinutes ?? 0,
      price: services.get(appointment.serviceId)?.price,
      status,
      origin: appointment.origin,
    };
  }
}

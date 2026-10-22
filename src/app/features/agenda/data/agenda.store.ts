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

@Injectable({ providedIn: 'root' })
export class AgendaStore {
  private readonly api = inject(AppointmentControllerService);
  private readonly servicesApi = inject(ServiceControllerService);
  private readonly auth = inject(AuthStore);
  private readonly datetime = inject(DatetimeService);
  private readonly appointmentsState = signal<readonly Appointment[]>(SAMPLE_APPOINTMENTS);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly demoState = signal(true);
  readonly appointments = this.appointmentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isDemo = this.demoState.asReadonly();
  readonly appointmentCount = computed(() => this.appointmentsState().length);
  readonly confirmedCount = computed(
    () => this.appointmentsState().filter(({ status }) => status === 'Confirmada').length,
  );
  readonly todayRevenue = computed(() =>
    this.appointmentsState()
      .filter(({ status, price }) => status !== 'Cancelada' && price !== undefined)
      .reduce((total, appointment) => total + (appointment.price ?? 0), 0),
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
      const prices = new Map(services.map((service) => [service.id, service.price]));
      this.appointmentsState.set(appointments.map((appointment) => this.fromApi(appointment, prices)));
      this.demoState.set(false);
    } catch {
      this.errorState.set('No se pudo cargar la agenda del servidor. Se muestran datos de demostración.');
      this.loadDemo();
      this.errorState.set('No se pudo cargar la agenda del servidor. Se muestran datos de demostración.');
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
      const prices = new Map(services.map((service) => [service.id, service.price]));
      this.appointmentsState.set(appointments.map((appointment) => this.fromApi(appointment, prices)));
      this.demoState.set(false);
    } catch {
      this.errorState.set('No se pudo cargar la agenda del servidor. Se muestran datos de demostración.');
      this.demoState.set(true);
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

  private fromApi(appointment: AppointmentResponse, prices: ReadonlyMap<number | undefined, number | undefined>): Appointment {
    const startsAt = appointment.startAt ? this.datetime.fromUtc(appointment.startAt) : this.datetime.now();
    const statusByApi: Record<NonNullable<AppointmentResponse['status']>, AppointmentStatus> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmada', COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'Cancelada',
    };
    const status = statusByApi[appointment.status ?? 'PENDING'];
    return {
      id: appointment.appointmentId ?? 0,
      client: appointment.customerName ?? 'Cliente',
      service: appointment.serviceName ?? 'Servicio',
      employee: appointment.employeeName ?? 'Por asignar',
      time: startsAt.format('HH:mm'),
      dateKey: startsAt.format('YYYY-MM-DD'),
      durationMinutes: appointment.serviceDurationMinutes ?? 0,
      price: prices.get(appointment.serviceId),
      status,
    };
  }
}

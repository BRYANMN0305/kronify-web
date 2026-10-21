import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppointmentControllerService } from '../../../core/api/openapi/api/appointmentController.service';
import { ServiceControllerService } from '../../../core/api/openapi/api/serviceController.service';
import type { AppointmentResponse } from '../../../core/api/openapi/model/appointmentResponse';
import type { AppointmentStatusUpdateRequest } from '../../../core/api/openapi/model/appointmentStatusUpdateRequest';
import { AuthStore } from '../../../core/auth/auth.store';
import { DatetimeService } from '../../../core/datetime/datetime.service';
import type { Appointment, AppointmentStatus } from './appointment.model';

const SAMPLE_APPOINTMENTS: Appointment[] = [
  { id: 1, client: 'Valentina Rojas', service: 'Corte y peinado', employee: 'Camila Torres', time: '08:30', durationMinutes: 60, price: 65000, status: 'Confirmada' },
  { id: 2, client: 'Mariana Pérez', service: 'Manicure semipermanente', employee: 'Laura Gómez', time: '09:00', durationMinutes: 75, price: 55000, status: 'Confirmada' },
  { id: 3, client: 'Sofía Martínez', service: 'Coloración', employee: 'Camila Torres', time: '10:00', durationMinutes: 120, price: 180000, status: 'Pendiente' },
  { id: 4, client: 'Isabella Castro', service: 'Diseño de cejas', employee: 'Laura Gómez', time: '11:30', durationMinutes: 30, price: 35000, status: 'Completada' },
  { id: 5, client: 'Luciana Herrera', service: 'Pedicure spa', employee: 'Daniela Ruiz', time: '12:00', durationMinutes: 60, price: 70000, status: 'Confirmada' },
  { id: 6, client: 'Gabriela Díaz', service: 'Limpieza facial', employee: 'Daniela Ruiz', time: '14:00', durationMinutes: 90, price: 95000, status: 'Pendiente' },
  { id: 7, client: 'Paula Mendoza', service: 'Corte de puntas', employee: 'Camila Torres', time: '15:30', durationMinutes: 45, price: 45000, status: 'Cancelada' },
  { id: 8, client: 'Manuela Silva', service: 'Manicure tradicional', employee: 'Laura Gómez', time: '16:30', durationMinutes: 45, price: 40000, status: 'Confirmada' },
];

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

  async loadToday(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.demoState.set(true);
      return;
    }

    const start = this.datetime.now().startOf('day');
    const end = start.add(1, 'day');
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [appointments, services] = await Promise.all([
        firstValueFrom(this.api.getAgenda(start.toISOString(), end.toISOString())),
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
      }[status];
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
    const status: AppointmentStatus = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmada', COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'Cancelada',
    }[appointment.status ?? 'PENDING'];
    return {
      id: appointment.appointmentId ?? 0,
      client: appointment.customerName ?? 'Cliente',
      service: appointment.serviceName ?? 'Servicio',
      employee: appointment.employeeName ?? 'Por asignar',
      time: startsAt.format('HH:mm'),
      durationMinutes: appointment.serviceDurationMinutes ?? 0,
      price: prices.get(appointment.serviceId),
      status,
    };
  }
}

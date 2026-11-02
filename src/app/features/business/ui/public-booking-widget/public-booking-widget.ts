import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicAppointmentControllerService } from '../../../../core/api/openapi/api/publicAppointmentController.service';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { AppointmentResponse } from '../../../../core/api/openapi/model/appointmentResponse';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { PublicServiceResponse } from '../../../../core/api/openapi/model/publicServiceResponse';
import type { TimeSlotResponse } from '../../../../core/api/openapi/model/timeSlotResponse';
import { announcePublicAppointmentCreated } from '../../../../core/events/public-appointment-created';
import { DatetimeService } from '../../../../core/datetime/datetime.service';

interface BookingDate { readonly key: string; readonly weekday: string; readonly day: string; readonly month: string; }

/** Reserva una cita pública usando el negocio, servicio y disponibilidad del slug. */
@Component({
  selector: 'app-public-booking-widget', standalone: true, imports: [CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './public-booking-widget.html', styleUrl: './public-booking-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBookingWidget implements OnInit {
  private readonly api = inject(PublicBusinessControllerService);
  private readonly appointmentsApi = inject(PublicAppointmentControllerService);
  private readonly datetime = inject(DatetimeService);
  private availabilityRequestId = 0;

  readonly business = input.required<PublicBusinessResponse>();
  readonly slug = input.required<string>();
  protected readonly dates = signal<readonly BookingDate[]>(this.makeDates());
  protected readonly selectedServiceId = signal<number | null>(null);
  protected readonly selectedDate = signal(this.datetime.now().format('YYYY-MM-DD'));
  protected readonly slots = signal<readonly TimeSlotResponse[]>([]);
  protected readonly selectedSlot = signal<TimeSlotResponse | null>(null);
  protected readonly selectedService = computed(() => this.business().services?.find((service) => service.serviceId === this.selectedServiceId()) ?? null);
  protected readonly dateLabel = computed(() => this.dateFor(this.selectedDate()));
  protected readonly customerName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly loadingAvailability = signal(false);
  protected readonly bookingBusy = signal(false);
  protected readonly bookingError = signal<string | null>(null);
  protected readonly bookingSuccess = signal<AppointmentResponse | null>(null);

  ngOnInit(): void {
    const firstServiceId = this.business().services?.find((service) => service.serviceId != null)?.serviceId;
    if (firstServiceId != null) {
      this.selectedServiceId.set(firstServiceId);
      void this.loadAvailability();
    }
  }

  protected chooseService(service: PublicServiceResponse): void {
    if (service.serviceId == null) return;
    this.selectedServiceId.set(service.serviceId);
    this.selectedSlot.set(null);
    this.bookingSuccess.set(null);
    void this.loadAvailability();
  }

  protected chooseDate(key: string): void {
    this.selectedDate.set(key);
    this.selectedSlot.set(null);
    this.bookingSuccess.set(null);
    void this.loadAvailability();
  }

  protected chooseSlot(slot: TimeSlotResponse): void {
    this.selectedSlot.set(slot);
    this.bookingError.set(null);
  }

  protected slotLabel(startAt?: string): string {
    if (!startAt) return 'Hora no disponible';
    const date = new Date(startAt);
    return Number.isNaN(date.getTime()) ? startAt : new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  }

  protected bookingReady(): boolean {
    const slot = this.selectedSlot();
    return !this.bookingBusy() && this.selectedServiceId() != null && !!slot?.startAt && slot.employeeId != null
      && !!this.customerName().trim() && this.customerPhone().replace(/\D/g, '').length >= 7;
  }

  protected async loadAvailability(): Promise<void> {
    const requestId = ++this.availabilityRequestId;
    const serviceId = this.selectedServiceId();
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.bookingError.set(null);
    if (serviceId == null || !this.slug()) return;
    this.loadingAvailability.set(true);
    try {
      const result = await firstValueFrom(this.api.getAvailability(this.slug(), serviceId, this.selectedDate()));
      if (requestId === this.availabilityRequestId) this.slots.set(result.slots ?? []);
    } catch (error) {
      if (requestId === this.availabilityRequestId) this.bookingError.set(this.errorMessage(error));
    } finally {
      if (requestId === this.availabilityRequestId) this.loadingAvailability.set(false);
    }
  }

  protected async submitBooking(): Promise<void> {
    const business = this.business();
    const serviceId = this.selectedServiceId();
    const slot = this.selectedSlot();
    if (business.businessId == null || serviceId == null || !slot?.startAt || slot.employeeId == null) {
      this.bookingError.set('Elige un servicio, un día y una hora disponible para continuar.');
      return;
    }
    if (!this.customerName().trim() || this.customerPhone().replace(/\D/g, '').length < 7) {
      this.bookingError.set('Escribe tu nombre y un celular válido para confirmar la cita.');
      return;
    }

    this.bookingBusy.set(true);
    this.bookingError.set(null);
    try {
      const appointment = await firstValueFrom(this.appointmentsApi.createAppointment1({
        businessId: business.businessId,
        serviceId,
        employeeId: slot.employeeId,
        startAt: slot.startAt,
        customerName: this.customerName().trim(),
        customerPhone: this.customerPhone().trim(),
      }));
      this.bookingSuccess.set(appointment);
      announcePublicAppointmentCreated(appointment);
    } catch (error) {
      this.bookingError.set(this.errorMessage(error));
      void this.loadAvailability();
    } finally { this.bookingBusy.set(false); }
  }

  protected bookAnother(): void {
    this.bookingSuccess.set(null);
    this.customerName.set('');
    this.customerPhone.set('');
    this.selectedSlot.set(null);
    void this.loadAvailability();
  }

  private makeDates(): readonly BookingDate[] {
    const today = this.datetime.now().startOf('day');
    return Array.from({ length: 14 }, (_, index) => {
      const date = today.add(index, 'day');
      return {
        key: date.format('YYYY-MM-DD'),
        weekday: index === 0 ? 'Hoy' : date.toDate().toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
        day: date.format('DD'),
        month: date.toDate().toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
      };
    });
  }

  private dateFor(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return this.datetime.at(year, month - 1, day).toDate().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown; detail?: unknown; title?: unknown; errors?: unknown } | string | null;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const message = body.message ?? body.detail ?? body.title;
        if (typeof message === 'string' && message.trim()) return message;
        if (body.errors && typeof body.errors === 'object') {
          const details = Object.values(body.errors as Record<string, unknown>).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string');
          if (details.length) return details.join(' ');
        }
      }
      return `No se pudo consultar el servidor (error ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}

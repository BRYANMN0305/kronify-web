import { CurrencyPipe, DatePipe, DOCUMENT, TitleCasePipe } from '@angular/common';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicAppointmentControllerService } from '../../../../core/api/openapi/api/publicAppointmentController.service';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { AppointmentResponse } from '../../../../core/api/openapi/model/appointmentResponse';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { PublicServiceResponse } from '../../../../core/api/openapi/model/publicServiceResponse';
import type { TimeSlotResponse } from '../../../../core/api/openapi/model/timeSlotResponse';
import { announcePublicAppointmentCreated } from '../../../../core/events/public-appointment-created';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { SKIP_AUTH } from '../../../../core/api/jwt.interceptor';

interface BookingDate { readonly key: string; readonly weekday: string; readonly day: string; readonly month: string; }

/** Horario visible: cuando no se elige profesional agrupa los cupos de la misma hora. */
interface BookingSlot extends TimeSlotResponse {
  readonly count?: number;
  readonly employeeIds?: readonly number[];
}

/** Reserva una cita pública en un modal usando el negocio, su equipo y disponibilidad del slug. */
@Component({
  selector: 'app-public-booking-widget', standalone: true, imports: [CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './public-booking-widget.html', styleUrl: './public-booking-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBookingWidget implements OnInit, OnDestroy {
  private readonly api = inject(PublicBusinessControllerService);
  private readonly appointmentsApi = inject(PublicAppointmentControllerService);
  private readonly auth = inject(AuthStore);
  private readonly datetime = inject(DatetimeService);
  private readonly document = inject(DOCUMENT);
  private readonly previousBodyOverflow = this.document.body.style.overflow;
  private availabilityRequestId = 0;

  readonly business = input.required<PublicBusinessResponse>();
  readonly slug = input.required<string>();
  readonly initialServiceId = input<number | null>(null);
  readonly closed = output<void>();
  protected readonly dates = signal<readonly BookingDate[]>(this.makeDates());
  protected readonly selectedServiceId = signal<number | null>(null);
  protected readonly selectedEmployeeId = signal<number | null>(null);
  protected readonly selectedDate = signal(this.dates()[0]?.key ?? this.datetime.now().format('YYYY-MM-DD'));
  protected readonly slots = signal<readonly TimeSlotResponse[]>([]);
  protected readonly selectedSlot = signal<TimeSlotResponse | null>(null);
  protected readonly selectedService = computed(() => this.business().services?.find((service) => service.serviceId === this.selectedServiceId()) ?? null);
  protected readonly employeesForService = computed(() => {
    const serviceId = this.selectedServiceId();
    return (this.business().employees ?? []).filter((employee) => employee.employeeId != null
      && (!employee.serviceIds?.length || serviceId == null || employee.serviceIds.includes(serviceId)));
  });
  protected readonly selectedEmployee = computed(() => this.employeesForService().find((employee) => employee.employeeId === this.selectedEmployeeId()) ?? null);
  protected readonly dateLabel = computed(() => this.dateFor(this.selectedDate()));
  protected readonly customerName = signal('');
  protected readonly customerLastName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly customerEmail = signal('');
  protected readonly loadingAvailability = signal(false);
  protected readonly bookingBusy = signal(false);
  protected readonly bookingError = signal<string | null>(null);
  protected readonly bookingSuccess = signal<AppointmentResponse | null>(null);

  /** Sin profesional elegido, agrupa los cupos por hora para ofrecer "cualquiera disponible". */
  protected readonly displaySlots = computed<readonly BookingSlot[]>(() => {
    if (this.selectedEmployeeId() != null) return this.slots();
    const groups = new Map<string, { startAt: string; endAt?: string; employeeIds: number[]; employeeNames: string[] }>();
    for (const slot of this.slots()) {
      if (!slot.startAt) continue;
      const group = groups.get(slot.startAt) ?? { startAt: slot.startAt, endAt: slot.endAt, employeeIds: [], employeeNames: [] };
      if (slot.employeeId != null) group.employeeIds.push(slot.employeeId);
      if (slot.employeeName) group.employeeNames.push(slot.employeeName);
      groups.set(slot.startAt, group);
    }
    return [...groups.values()]
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .map((group) => ({
        startAt: group.startAt,
        endAt: group.endAt,
        employeeId: group.employeeIds[0],
        employeeName: group.employeeNames[0],
        count: group.employeeIds.length,
        employeeIds: group.employeeIds,
      }));
  });

  constructor() {
    this.document.body.style.overflow = 'hidden';
  }

  ngOnInit(): void {
    const services = this.business().services ?? [];
    const preferred = this.initialServiceId();
    const serviceId = preferred != null && services.some((service) => service.serviceId === preferred)
      ? preferred
      : services.find((service) => service.serviceId != null)?.serviceId;
    if (serviceId != null) {
      this.selectedServiceId.set(serviceId);
      this.selectedEmployeeId.set(null);
      void this.loadAvailability();
    }
    void this.loadAutofill();
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  /** Cierra solo cuando el clic cae fuera del panel. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.bookingBusy()) this.closed.emit();
  }

  protected close(): void {
    if (!this.bookingBusy()) this.closed.emit();
  }

  protected chooseService(service: PublicServiceResponse): void {
    if (service.serviceId == null) return;
    this.selectedServiceId.set(service.serviceId);
    this.selectedEmployeeId.set(null);
    this.selectedSlot.set(null);
    this.bookingSuccess.set(null);
    void this.loadAvailability();
  }

  protected chooseEmployee(value: string): void {
    this.selectedEmployeeId.set(value ? Number(value) : null);
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

  protected chooseSlot(slot: BookingSlot): void {
    const employeeId = slot.employeeId ?? slot.employeeIds?.[0];
    if (employeeId == null) {
      this.bookingError.set('Ese horario no tiene un profesional asignado. Elige otro.');
      return;
    }
    this.selectedSlot.set({
      ...slot,
      employeeId,
      employeeName: slot.employeeName ?? 'Profesional',
    });
    this.bookingError.set(null);
  }

  protected slotLabel(startAt?: string): string {
    if (!startAt) return 'Hora no disponible';
    const date = new Date(startAt);
    return Number.isNaN(date.getTime()) ? startAt : new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  }

  protected bookingReady(): boolean {
    const slot = this.selectedSlot();
    return !this.bookingBusy() && this.selectedServiceId() != null && slot?.employeeId != null
      && !!slot.startAt && !!this.customerName().trim()
      && this.customerPhone().replace(/\D/g, '').length >= 7;
  }

  protected async loadAvailability(): Promise<void> {
    const requestId = ++this.availabilityRequestId;
    const serviceId = this.selectedServiceId();
    const employeeId = this.selectedEmployeeId();
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.bookingError.set(null);
    if (serviceId == null || !this.slug()) {
      this.loadingAvailability.set(false);
      return;
    }

    this.loadingAvailability.set(true);
    try {
      const result = await firstValueFrom(this.api.getAvailability(
        this.slug(), serviceId, this.selectedDate(), employeeId ?? undefined,
        'body', false, { context: new HttpContext().set(SKIP_AUTH, true) },
      ));
      if (requestId === this.availabilityRequestId) {
        const received = result.slots ?? [];
        this.slots.set(employeeId == null ? received : received.filter((slot) => slot.employeeId === employeeId));
      }
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
    const employeeId = slot?.employeeId;
    if (business.businessId == null || serviceId == null || employeeId == null || !slot?.startAt) {
      this.bookingError.set('Elige un servicio, un día y una hora disponible.');
      return;
    }
    if (!this.customerName().trim() || this.customerPhone().replace(/\D/g, '').length < 7) {
      this.bookingError.set('Escribe tu nombre y un celular válido para confirmar la cita.');
      return;
    }

    this.bookingBusy.set(true);
    this.bookingError.set(null);
    try {
      // Un cliente autenticado envía su token: el backend asocia la cita a su
      // cuenta y así aparece en /mis-citas y en su calendario personal.
      const isClient = this.auth.profileType() === 'CLIENT';
      const appointment = await firstValueFrom(this.appointmentsApi.createAppointment1(
        {
          businessId: business.businessId,
          serviceId,
          employeeId,
          startAt: slot.startAt,
          customerName: this.customerName().trim(),
          customerLastName: this.customerLastName().trim() || undefined,
          customerPhone: this.customerPhone().trim(),
          customerEmail: this.customerEmail().trim() || undefined,
        },
        'body',
        false,
        isClient ? undefined : { context: new HttpContext().set(SKIP_AUTH, true) },
      ));
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
    this.customerLastName.set('');
    this.customerPhone.set('');
    this.customerEmail.set('');
    this.selectedSlot.set(null);
    void this.loadAvailability();
  }

  /** Autocompleta los datos del cliente autenticado; los invitados escriben todo. */
  private async loadAutofill(): Promise<void> {
    if (this.auth.profileType() !== 'CLIENT') return;
    try {
      const data = await firstValueFrom(this.appointmentsApi.getAutofill());
      this.customerName.set(data.name ?? '');
      this.customerLastName.set(data.lastName ?? '');
      this.customerPhone.set(data.phoneNumber ?? '');
      this.customerEmail.set(data.email ?? '');
    } catch {
      // Sin autofill la reserva sigue disponible con captura manual.
    }
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

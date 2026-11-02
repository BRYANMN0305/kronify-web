import { HttpErrorResponse } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Dayjs } from 'dayjs';
import { firstValueFrom } from 'rxjs';
import { AppointmentControllerService } from '../../../../core/api/openapi/api/appointmentController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';
import type { TimeSlotResponse } from '../../../../core/api/openapi/model/timeSlotResponse';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DatetimeService } from '../../../../core/datetime/datetime.service';

interface CalendarCell {
  readonly key: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly today: boolean;
  readonly disabled: boolean;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Modal para registrar una cita en un horario realmente disponible del negocio. */
@Component({
  selector: 'app-create-appointment-dialog', standalone: true, imports: [FormsModule, TitleCasePipe],
  templateUrl: './create-appointment-page.html', styleUrl: './create-appointment-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAppointmentDialog implements OnInit {
  private readonly appointmentsApi = inject(AppointmentControllerService);
  private readonly employeesApi = inject(EmployeeControllerService);
  private readonly servicesApi = inject(ServiceControllerService);
  private readonly availabilityApi = inject(PublicBusinessControllerService);
  private readonly auth = inject(AuthStore);
  private readonly datetime = inject(DatetimeService);
  private availabilityRequestId = 0;

  readonly closed = output<void>();
  readonly created = output<void>();
  protected readonly services = signal<readonly ServiceResponse[]>([]);
  protected readonly employees = signal<readonly EmployeeResponse[]>([]);
  protected readonly slots = signal<readonly TimeSlotResponse[]>([]);
  protected readonly selectedSlot = signal<TimeSlotResponse | null>(null);
  protected readonly month = signal(this.datetime.now().startOf('month'));
  protected readonly selectedDate = signal(this.datetime.now().format('YYYY-MM-DD'));
  protected readonly weekdays = WEEKDAYS;
  protected readonly calendarWeeks = computed(() => this.makeCalendar(this.month()));
  protected readonly canGoPrevious = computed(() => this.month().isAfter(this.datetime.now().startOf('month')));
  protected readonly monthLabel = computed(() => this.month().toDate().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
  protected readonly dateLabel = computed(() => this.formatDate(this.selectedDate()));
  protected readonly form = signal({ serviceId: '', employeeId: '', customerName: '', customerLastName: '', customerPhone: '', customerEmail: '' });
  protected readonly busy = signal(false);
  protected readonly loadingOptions = signal(true);
  protected readonly loadingAvailability = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly availabilityError = signal<string | null>(null);

  ngOnInit(): void { void this.loadOptions(); }

  protected update<K extends keyof ReturnType<typeof this.form>>(field: K, value: ReturnType<typeof this.form>[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }
  protected async loadOptions(): Promise<void> {
    this.loadingOptions.set(true);
    const [servicesResult, employeesResult] = await Promise.allSettled([
      firstValueFrom(this.servicesApi.listServices()),
      firstValueFrom(this.employeesApi.listEmployees()),
    ]);
    if (servicesResult.status === 'fulfilled') {
      this.services.set((servicesResult.value ?? []).filter((item) => item.active !== false && item.id != null));
      if (!this.services().length) this.error.set('No hay servicios activos que se puedan reservar.');
    } else {
      this.error.set(`No se pudieron cargar los servicios: ${this.errorMessage(servicesResult.reason)}`);
    }
    if (employeesResult.status === 'fulfilled') {
      this.employees.set((employeesResult.value ?? []).filter((item) => item.active !== false && item.employeeId != null));
      if (!this.employees().length) this.error.set('No hay profesionales activos para asignar una cita.');
    } else {
      this.error.set(`No se pudieron cargar los profesionales: ${this.errorMessage(employeesResult.reason)}`);
    }
    this.loadingOptions.set(false);
  }
  protected serviceChanged(value: string): void {
    this.form.update((current) => ({ ...current, serviceId: value }));
    void this.loadAvailability();
  }
  protected employeeChanged(value: string): void {
    this.form.update((current) => ({ ...current, employeeId: value }));
    void this.loadAvailability();
  }
  protected previousMonth(): void {
    if (!this.canGoPrevious()) return;
    this.showMonth(this.month().subtract(1, 'month'));
  }
  protected nextMonth(): void { this.showMonth(this.month().add(1, 'month')); }
  protected chooseDate(date: string): void {
    this.selectedDate.set(date);
    this.selectedSlot.set(null);
    void this.loadAvailability();
  }
  protected chooseSlot(slot: TimeSlotResponse): void { this.selectedSlot.set(slot); this.error.set(null); }
  protected slotLabel(startAt?: string): string {
    if (!startAt) return 'Hora no disponible';
    return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(startAt));
  }
  protected cancel(): void { if (!this.busy()) this.closed.emit(); }

  protected async loadAvailability(): Promise<void> {
    const requestId = ++this.availabilityRequestId;
    this.loadingAvailability.set(false);
    const { serviceId, employeeId } = this.form();
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.availabilityError.set(null);
    if (!serviceId || !employeeId) return;

    const slug = this.auth.user()?.slug;
    if (!slug) {
      this.availabilityError.set('No encontramos el enlace público del negocio para consultar horarios. Cierra sesión y vuelve a entrar para actualizar la sesión.');
      return;
    }

    this.loadingAvailability.set(true);
    try {
      const result = await firstValueFrom(this.availabilityApi.getAvailability(
        slug, Number(serviceId), this.selectedDate(), Number(employeeId),
      ));
      if (requestId === this.availabilityRequestId) this.slots.set(result.slots ?? []);
    } catch (error) {
      if (requestId === this.availabilityRequestId) this.availabilityError.set(this.errorMessage(error));
    } finally {
      if (requestId === this.availabilityRequestId) this.loadingAvailability.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const value = this.form();
    const slot = this.selectedSlot();
    if (!value.serviceId || !value.employeeId || !slot?.startAt || !value.customerName.trim()) {
      this.error.set('Selecciona servicio, profesional, una hora disponible y escribe el nombre del cliente.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.appointmentsApi.createAppointment({
        serviceId: Number(value.serviceId),
        employeeId: slot.employeeId ?? Number(value.employeeId),
        startAt: slot.startAt,
        customerName: value.customerName.trim(),
        customerLastName: value.customerLastName.trim() || undefined,
        customerPhone: value.customerPhone.trim() || undefined,
        customerEmail: value.customerEmail.trim() || undefined,
      }));
      this.created.emit();
    } catch (error) {
      this.error.set(this.errorMessage(error));
      void this.loadAvailability();
    } finally { this.busy.set(false); }
  }

  private makeCalendar(month: Dayjs): readonly (readonly CalendarCell[])[] {
    const first = month.startOf('month');
    const mondayOffset = (first.day() + 6) % 7;
    const start = first.subtract(mondayOffset, 'day');
    const today = this.datetime.now().startOf('day');
    return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, dayIndex) => {
      const date = start.add(week * 7 + dayIndex, 'day');
      const key = date.format('YYYY-MM-DD');
      return {
        key,
        day: date.date(),
        inMonth: date.month() === month.month(),
        today: key === today.format('YYYY-MM-DD'),
        disabled: !date.isSame(today, 'day') && date.isBefore(today, 'day') || date.month() !== month.month(),
      };
    }));
  }
  private showMonth(month: Dayjs): void {
    this.month.set(month);
    const today = this.datetime.now().startOf('day');
    const firstDay = month.startOf('month');
    this.chooseDate(firstDay.isBefore(today, 'day') ? today.format('YYYY-MM-DD') : firstDay.format('YYYY-MM-DD'));
  }
  private formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return this.datetime.at(year, month - 1, day).toDate().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
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
      return `Error ${error.status}: ${error.statusText || 'el servidor rechazó la solicitud'}`;
    }
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}

import { ChangeDetectionStrategy, Component, computed, HostListener, inject, input, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { registerLocaleData, TitleCasePipe } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import type { Dayjs } from 'dayjs';
import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { AgendaStore } from '../../data/agenda.store';
import type { Appointment, AppointmentStatus } from '../../modelos/appointment.model';
import { AgendaSummary } from '../../ui/agenda-summary';
import { CalendarGrid } from '../../ui/calendar-grid';
import { DayAppointmentsDialog } from '../../ui/day-appointments-dialog';
import type { CalendarDay } from '../../ui/calendar-grid';
import { CreateAppointmentDialog } from '../create-appointment-page/create-appointment-page';
import { PUBLIC_APPOINTMENT_CREATED_KEY, readPublicAppointmentCreatedEvent } from '../../../../core/events/public-appointment-created';

// La agenda siempre presenta fechas y moneda con convenciones colombianas.
registerLocaleData(localeEsCo);


/** Coordina la navegación mensual y el acceso a datos mediante AgendaStore. */
@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [TitleCasePipe, AgendaSummary, CalendarGrid, DayAppointmentsDialog, CreateAppointmentDialog],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage implements OnInit {
  protected readonly store = inject(AgendaStore);
  private readonly datetime = inject(DatetimeService);
  readonly demoMode = input(false);

  protected readonly appointments = this.store.appointments;
  protected readonly loading = this.store.loading;
  protected readonly isDemo = this.store.isDemo;
  protected readonly storeError = this.store.error;
  protected readonly month = signal(this.datetime.now().startOf('month'));
  protected readonly selectedDate = signal(this.datetime.now().startOf('day'));
  protected readonly today = this.datetime.now().toDate();
  protected readonly dayDialogOpen = signal(false);
  protected readonly createDialogOpen = signal(false);

  protected readonly visibleAppointments = computed(() => this.appointments().filter((appointment) => {
    const key = appointment.dateKey ?? this.datetime.now().format('YYYY-MM-DD');
    return key === this.selectedDate().format('YYYY-MM-DD');
  }));
  protected readonly calendarWeeks = computed(() => this.makeCalendar(this.month(), this.appointments()));
  protected readonly selectedDayKey = computed(() => this.selectedDate().format('YYYY-MM-DD'));

  ngOnInit(): void {
    if (this.demoMode()) this.store.loadDemo();
    else this.loadMonth();
  }

  @HostListener('window:storage', ['$event'])
  protected onPublicAppointmentStored(event: StorageEvent): void {
    if (event.key !== PUBLIC_APPOINTMENT_CREATED_KEY || this.isDemo()) return;
    const payload = readPublicAppointmentCreatedEvent(event.newValue);
    if (!payload?.startAt) { this.loadMonth(); return; }
    const appointmentDate = this.datetime.fromLocal(payload.startAt);
    this.month.set(appointmentDate.startOf('month'));
    this.selectedDate.set(appointmentDate.startOf('day'));
    this.dayDialogOpen.set(false);
    this.loadMonth();
  }

  @HostListener('window:focus')
  protected refreshWhenReturningToCalendar(): void {
    if (!this.isDemo()) this.loadMonth();
  }

  protected previousMonth(): void { this.changeMonth(this.month().subtract(1, 'month')); }
  protected nextMonth(): void { this.changeMonth(this.month().add(1, 'month')); }
  protected selectDay(date: Date): void {
    this.selectedDate.set(this.datetime.at(date.getFullYear(), date.getMonth(), date.getDate()).startOf('day'));
    this.dayDialogOpen.set(this.visibleAppointments().length > 0);
  }
  protected openCreateDialog(): void { if (!this.isDemo()) this.createDialogOpen.set(true); }
  protected closeCreateDialog(): void { this.createDialogOpen.set(false); }
  protected appointmentCreated(): void { this.createDialogOpen.set(false); this.loadMonth(); }
  protected closeDayDialog(): void { this.dayDialogOpen.set(false); }
  /** Navega al día anterior/siguiente desde el diálogo sin cerrarlo. */
  protected shiftDay(offset: number): void {
    const next = this.selectedDate().add(offset, 'day');
    const crossesMonth = next.month() !== this.month().month() || next.year() !== this.month().year();
    this.selectedDate.set(next.startOf('day'));
    this.dayDialogOpen.set(true);
    if (crossesMonth) {
      this.month.set(next.startOf('month'));
      this.loadMonth();
    }
  }
  protected updateAppointmentStatus(event: { id: number; status: AppointmentStatus }): void {
    void this.store.updateStatus(event.id, event.status);
  }
  protected monthLabel(): string { return this.month().format('MMMM YYYY'); }

  private changeMonth(month: Dayjs): void {
    this.month.set(month);
    this.selectedDate.set(month.startOf('month'));
    this.loadMonth();
  }

  private loadMonth(): void {
    const start = this.month().startOf('month');
    // AppointmentController binds both query params as LocalDate (YYYY-MM-DD).
    // Its range is inclusive, so send the final day of this month as endDate.
    const end = start.add(1, 'month').subtract(1, 'day');
    void this.store.loadRange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  }

  private makeCalendar(month: Dayjs, appointments: readonly Appointment[]): readonly (readonly CalendarDay[])[] {
    const first = month.startOf('month');
    const mondayOffset = (first.day() + 6) % 7;
    const start = first.subtract(mondayOffset, 'day');
    const todayKey = this.datetime.now().format('YYYY-MM-DD');
    return Array.from({ length: 6 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = start.add(weekIndex * 7 + dayIndex, 'day');
        const key = date.format('YYYY-MM-DD');
        return {
          date: date.toDate(),
          key,
          dayNumber: date.date(),
          belongsToMonth: date.month() === month.month(),
          isToday: key === todayKey,
          appointments: appointments.filter((appointment) => (appointment.dateKey ?? todayKey) === key),
        };
      }),
    );
  }
}

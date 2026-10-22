import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { DatePipe, registerLocaleData, TitleCasePipe } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import type { Dayjs } from 'dayjs';
import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { AgendaStore } from '../../data/agenda.store';
import type { Appointment, AppointmentStatus } from '../../modelos/appointment.model';
import { AgendaSummary } from '../../ui/agenda-summary';
import { AppointmentRow } from '../../ui/appointment-row';
import { CalendarGrid } from '../../ui/calendar-grid';
import type { CalendarDay } from '../../ui/calendar-grid';

registerLocaleData(localeEsCo);

@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, AgendaSummary, AppointmentRow, CalendarGrid],
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
  protected readonly selectedStatus = signal<'TODAS' | AppointmentStatus>('TODAS');
  protected readonly selectedEmployee = signal('TODOS');
  protected readonly selectedService = signal('TODOS');
  protected readonly today = this.datetime.now().toDate();

  protected readonly employees = computed(() => ['TODOS', ...new Set(this.appointments().map((item) => item.employee))]);
  protected readonly services = computed(() => ['TODOS', ...new Set(this.appointments().map((item) => item.service))]);
  protected readonly visibleAppointments = computed(() => this.appointments().filter((appointment) => {
    const key = appointment.dateKey ?? this.datetime.now().format('YYYY-MM-DD');
    return key === this.selectedDate().format('YYYY-MM-DD')
      && (this.selectedStatus() === 'TODAS' || appointment.status === this.selectedStatus())
      && (this.selectedEmployee() === 'TODOS' || appointment.employee === this.selectedEmployee())
      && (this.selectedService() === 'TODOS' || appointment.service === this.selectedService());
  }));
  protected readonly calendarWeeks = computed(() => this.makeCalendar(this.month(), this.appointments()));
  protected readonly selectedDayKey = computed(() => this.selectedDate().format('YYYY-MM-DD'));
  protected readonly statusFilters: readonly { label: string; value: 'TODAS' | AppointmentStatus }[] = [
    { label: 'Todos los estados', value: 'TODAS' },
    { label: 'Pendiente', value: 'Pendiente' },
    { label: 'Confirmada', value: 'Confirmada' },
    { label: 'Completada', value: 'Completada' },
    { label: 'Cancelada', value: 'Cancelada' },
  ];

  ngOnInit(): void {
    if (this.demoMode()) this.store.loadDemo();
    else this.loadMonth();
  }

  protected previousMonth(): void { this.changeMonth(this.month().subtract(1, 'month')); }
  protected nextMonth(): void { this.changeMonth(this.month().add(1, 'month')); }
  protected selectDay(date: Date): void { this.selectedDate.set(this.datetime.at(date.getFullYear(), date.getMonth(), date.getDate()).startOf('day')); }
  protected setStatus(value: string): void { this.selectedStatus.set(value as 'TODAS' | AppointmentStatus); }
  protected setEmployee(value: string): void { this.selectedEmployee.set(value); }
  protected setService(value: string): void { this.selectedService.set(value); }
  protected updateStatus(appointment: Appointment, status: AppointmentStatus): void { void this.store.updateStatus(appointment.id, status); }
  protected monthLabel(): string { return this.month().format('MMMM YYYY'); }
  protected revenueLabel(): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(this.store.todayRevenue());
  }

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

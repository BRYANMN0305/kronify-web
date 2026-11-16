import { registerLocaleData, TitleCasePipe } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import type { Dayjs } from 'dayjs';

import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { ClientAppointmentsStore } from '../../data/client-appointments.store';
import type { ClientAppointment, ClientAppointmentStatus } from '../../models/client-appointment.model';
import { CalendarGrid } from '../../../agenda/ui/calendar-grid';
import type { CalendarDay } from '../../../agenda/ui/calendar-grid';
import type { Appointment, AppointmentStatus } from '../../../agenda/modelos/appointment.model';
import { ClientAppointmentDetail } from '../../ui/client-appointment-detail';
import { ClientDayDialog } from '../../ui/client-day-dialog';

registerLocaleData(localeEsCo);

const BUSINESS_STATUS: Record<ClientAppointmentStatus, AppointmentStatus> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

/** Calendario personal del cliente: solo lectura, con acceso al detalle de cada cita. */
@Component({
  selector: 'app-client-calendar-page',
  standalone: true,
  imports: [TitleCasePipe, CalendarGrid, ClientDayDialog, ClientAppointmentDetail],
  templateUrl: './client-calendar-page.html',
  styleUrl: './client-calendar-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientCalendarPage implements OnInit {
  protected readonly store = inject(ClientAppointmentsStore);
  private readonly datetime = inject(DatetimeService);

  protected readonly month = signal(this.datetime.now().startOf('month'));
  protected readonly selectedDate = signal(this.datetime.now().startOf('day'));
  protected readonly dayDialogOpen = signal(false);
  protected readonly selectedAppointment = signal<ClientAppointment | null>(null);

  protected readonly monthAppointments = computed(() => this.store.history().filter((appointment) => {
    if (!appointment.startAt) return false;
    const date = this.datetime.fromLocal(appointment.startAt);
    return date.month() === this.month().month() && date.year() === this.month().year();
  }));

  protected readonly calendarWeeks = computed(() => this.makeCalendar(this.month(), this.store.history()));
  protected readonly selectedDayKey = computed(() => this.selectedDate().format('YYYY-MM-DD'));
  protected readonly dayAppointments = computed(() => this.store.history()
    .filter((appointment) => appointment.startAt && this.datetime.fromLocal(appointment.startAt).format('YYYY-MM-DD') === this.selectedDayKey())
    .sort((left, right) => left.startAt.localeCompare(right.startAt)));

  ngOnInit(): void {
    void this.store.loadHistory(200, 'startAt,asc');
  }

  protected previousMonth(): void {
    this.changeMonth(this.month().subtract(1, 'month'));
  }

  protected nextMonth(): void {
    this.changeMonth(this.month().add(1, 'month'));
  }

  protected selectDay(date: Date): void {
    this.selectedDate.set(this.datetime.at(date.getFullYear(), date.getMonth(), date.getDate()).startOf('day'));
    this.dayDialogOpen.set(this.dayAppointments().length > 0);
  }

  protected shiftDay(offset: number): void {
    const next = this.selectedDate().add(offset, 'day');
    this.selectedDate.set(next.startOf('day'));
    this.dayDialogOpen.set(true);
    if (next.month() !== this.month().month() || next.year() !== this.month().year()) {
      this.month.set(next.startOf('month'));
    }
  }

  protected closeDayDialog(): void {
    this.dayDialogOpen.set(false);
  }

  protected openDetail(appointment: ClientAppointment): void {
    this.selectedAppointment.set(appointment);
    this.dayDialogOpen.set(false);
  }

  protected closeDetail(): void {
    this.selectedAppointment.set(null);
  }

  protected detailUpdated(updated: ClientAppointment): void {
    this.selectedAppointment.set(updated);
  }

  protected monthLabel(): string {
    return this.month().format('MMMM YYYY');
  }

  private changeMonth(month: Dayjs): void {
    this.month.set(month);
    this.selectedDate.set(month.startOf('month'));
    this.dayDialogOpen.set(false);
  }

  private makeCalendar(month: Dayjs, appointments: readonly ClientAppointment[]): readonly (readonly CalendarDay[])[] {
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
          appointments: appointments
            .filter((appointment) => appointment.startAt && this.datetime.fromLocal(appointment.startAt).format('YYYY-MM-DD') === key)
            .sort((left, right) => left.startAt.localeCompare(right.startAt))
            .map((appointment) => this.toCalendarAppointment(appointment)),
        };
      }),
    );
  }

  private toCalendarAppointment(appointment: ClientAppointment): Appointment {
    const startsAt = appointment.startAt ? this.datetime.fromLocal(appointment.startAt) : this.datetime.now();
    const endsAt = appointment.endAt ? this.datetime.fromLocal(appointment.endAt) : null;
    return {
      id: appointment.id,
      client: appointment.customerName ?? 'Mi cita',
      email: appointment.customerEmail,
      phone: appointment.customerPhone,
      service: appointment.serviceName,
      employee: appointment.employeeName,
      time: startsAt.format('HH:mm'),
      endTime: endsAt?.format('HH:mm'),
      dateKey: startsAt.format('YYYY-MM-DD'),
      durationMinutes: appointment.serviceDurationMinutes,
      status: BUSINESS_STATUS[appointment.status],
      origin: appointment.origin,
    };
  }
}

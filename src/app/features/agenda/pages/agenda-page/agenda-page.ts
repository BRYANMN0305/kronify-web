import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { AgendaStore } from '../../data/agenda.store';
import type { Appointment, AppointmentStatus } from '../../data/appointment.model';
import { AppointmentRow } from '../../ui/appointment-row';
import { AgendaSummary } from '../../ui/agenda-summary';

registerLocaleData(localeEsCo);

@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, AppointmentRow, AgendaSummary],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage implements OnInit {
  private readonly store = inject(AgendaStore);
  protected readonly appointments = this.store.appointments;
  protected readonly confirmedCount = this.store.confirmedCount;
  protected readonly appointmentCount = this.store.appointmentCount;
  protected readonly todayRevenue = this.store.todayRevenue;
  protected readonly loading = this.store.loading;
  protected readonly isDemo = this.store.isDemo;
  protected readonly storeError = this.store.error;
  protected readonly activeFilter = signal<'Todas' | AppointmentStatus>('Todas');
  protected readonly filters: readonly ('Todas' | AppointmentStatus)[] = ['Todas', 'Confirmada', 'Pendiente', 'Completada', 'Cancelada'];
  protected readonly visibleAppointments = computed(() => {
    const filter = this.activeFilter();
    return filter === 'Todas' ? this.appointments() : this.appointments().filter(({ status }) => status === filter);
  });
  protected readonly today = new Date();

  ngOnInit(): void { void this.store.loadToday(); }

  protected setFilter(filter: 'Todas' | AppointmentStatus): void { this.activeFilter.set(filter); }
  protected updateStatus(appointment: Appointment, status: AppointmentStatus): void { void this.store.updateStatus(appointment.id, status); }
  protected revenueLabel(): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(this.todayRevenue());
  }
}

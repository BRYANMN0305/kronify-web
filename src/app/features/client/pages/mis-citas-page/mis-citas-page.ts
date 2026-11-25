import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { ClientAppointmentsStore } from '../../data/client-appointments.store';
import type { ClientAppointment, ClientAppointmentStatus, RecentBusiness } from '../../models/client-appointment.model';
import { ClientAppointmentDetail } from '../../ui/client-appointment-detail';
import { ClientReviewDialog } from '../../ui/client-review-dialog';

const STATUS_LABELS: Record<ClientAppointmentStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

const STATUS_CLASSES: Record<ClientAppointmentStatus, string> = {
  PENDING: 'is-pending',
  CONFIRMED: 'is-confirmed',
  COMPLETED: 'is-completed',
  CANCELLED: 'is-cancelled',
  NO_SHOW: 'is-cancelled',
};

/** Historial del cliente, negocios recientes y acciones sobre sus citas. */
@Component({
  selector: 'app-mis-citas-page',
  standalone: true,
  imports: [ClientAppointmentDetail, ClientReviewDialog],
  templateUrl: './mis-citas-page.html',
  styleUrl: './mis-citas-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisCitasPage implements OnInit {
  protected readonly store = inject(ClientAppointmentsStore);
  private readonly auth = inject(AuthStore);
  private readonly datetime = inject(DatetimeService);
  private readonly router = inject(Router);

  protected readonly selectedAppointment = signal<ClientAppointment | null>(null);
  protected readonly reviewAppointment = signal<ClientAppointment | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly isClient = computed(() => this.auth.profileType() === 'CLIENT');
  protected readonly appointments = this.store.history;
  protected readonly recentBusinesses = this.store.recentBusinesses;
  protected readonly showRecent = computed(() => !this.store.recentUnavailable());

  ngOnInit(): void {
    void this.store.loadHistory(100, 'startAt,desc');
    void this.store.loadRecentBusinesses();
  }

  protected openDetail(appointment: ClientAppointment): void {
    this.selectedAppointment.set(appointment);
  }

  protected openReview(appointment: ClientAppointment): void {
    this.reviewAppointment.set(appointment);
  }

  protected closeDetail(): void {
    this.selectedAppointment.set(null);
  }

  protected closeReview(): void {
    this.reviewAppointment.set(null);
  }

  protected detailUpdated(updated: ClientAppointment): void {
    this.selectedAppointment.set(updated);
    this.actionError.set(null);
  }

  protected async cancel(appointment: ClientAppointment): Promise<void> {
    this.actionError.set(null);
    const success = await this.store.cancel(appointment.id);
    if (!success) this.actionError.set('No se pudo cancelar la cita. Intenta de nuevo.');
  }

  protected openBusiness(business: RecentBusiness): void {
    if (!business.slug) return;
    void this.router.navigate(['/negocio', business.slug]);
  }

  protected canCancel(appointment: ClientAppointment): boolean {
    return appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  }

  protected canReview(appointment: ClientAppointment): boolean {
    return appointment.status === 'COMPLETED' && !this.store.reviewedIds().has(appointment.id) && this.isClient();
  }

  protected canManage(appointment: ClientAppointment): boolean {
    return appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  }

  protected isBusy(appointment: ClientAppointment): boolean {
    return this.store.busyId() === appointment.id;
  }

  protected statusLabel(status: ClientAppointmentStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusClass(status: ClientAppointmentStatus): string {
    return STATUS_CLASSES[status];
  }

  protected dateLabel(value: string): string {
    if (!value) return '—';
    return this.datetime.fromLocal(value).toDate().toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  protected timeLabel(value: string): string {
    if (!value) return '—';
    return this.datetime.fromLocal(value).toDate().toLocaleTimeString('es-CO', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  protected initials(value: string): string {
    return value.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'N';
  }

  protected logoUrl(business: RecentBusiness): string | null {
    if (!business.logoUrl) return null;
    if (/^(https?:|data:|blob:)/i.test(business.logoUrl)) return business.logoUrl;
    return business.logoUrl.startsWith('/') ? `${environment.apiUrl}${business.logoUrl}` : business.logoUrl;
  }

  protected lastVisitLabel(business: RecentBusiness): string {
    if (!business.lastAppointmentAt) return 'Sin fecha';
    return new Date(business.lastAppointmentAt).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}

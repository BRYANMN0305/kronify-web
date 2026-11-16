import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';
import { AppointmentStatusClassPipe } from './appointment-status.pipe';

/** Fila de una cita dentro del detalle del día: hora, cliente, servicio y acciones. */
@Component({
  selector: 'app-appointment-row',
  standalone: true,
  imports: [CurrencyPipe, AppointmentStatusClassPipe],
  template: `
    <article class="appointment-row" [class.is-flagged]="flagged()">
      <div class="row-time">
        <strong>{{ appointment().time }}</strong>
        <span>{{ endLabel() }}</span>
      </div>

      <span class="avatar" aria-hidden="true">{{ initials() }}</span>

      <div class="row-body">
        <strong class="row-name">{{ appointment().client }}</strong>
        <small class="row-service">{{ appointment().service }} · {{ appointment().employee }}</small>
        <div class="row-meta">
          <span [class]="'status-pill ' + (appointment().status | appointmentStatusClass)">{{ appointment().status }}</span>
          @if (appointment().origin === 'PUBLIC') { <span class="origin-badge">Reserva en línea</span> }
          @if (phoneLabel(); as phone) { <a class="row-phone" [href]="'tel:' + appointment().phone">{{ phone }}</a> }
          @if (appointment().email) { <a class="row-phone row-email" [href]="'mailto:' + appointment().email">{{ appointment().email }}</a> }
        </div>
      </div>

      <div class="row-end">
        <strong class="row-price">
          @if (appointment().price !== undefined) {
            {{ appointment().price | currency:'COP':'symbol':'1.0-0':'es-CO' }}
          } @else {
            <span aria-label="Precio no disponible">—</span>
          }
        </strong>
        <div class="row-actions">
          @if (actionLabel(); as label) {
            <button type="button" class="btn-kronify row-action" (click)="advance()">{{ label }}</button>
          }
          @if (canManage()) {
            <button type="button" class="btn-kronify-outline row-action row-action--muted" (click)="reschedule.emit()">Reprogramar</button>
            <button type="button" class="btn-kronify-outline row-action row-action--danger" (click)="statusChange.emit('Cancelada')">Cancelar</button>
            <button type="button" class="btn-kronify-outline row-action row-action--muted" (click)="statusChange.emit('No asistió')">No asistió</button>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; font-family: var(--font-ui); }
    .appointment-row {
      display: grid;
      grid-template-columns: 78px 40px minmax(0, 1fr) auto;
      align-items: start;
      column-gap: 14px;
      border-radius: var(--radius-lg);
      padding: 15px 6px;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .appointment-row.is-flagged {
      background: #16323b;
      box-shadow: inset 0 0 0 1px #2c5b66;
    }
    .row-time { display: grid; gap: 1px; }
    .row-time strong { color: #f2fbfd; font-size: var(--text-2xl); font-weight: 700; letter-spacing: -0.01em; }
    .row-time span { color: #88a5ad; font-size: var(--text-xs); }
    .avatar {
      display: grid; width: 40px; height: 40px; place-items: center;
      border-radius: 50%; background: #1e4550; color: #68d9ed;
      font-size: var(--text-sm); font-weight: 700; letter-spacing: 0.02em;
    }
    .row-body { display: grid; min-width: 0; gap: 2px; }
    .row-name { overflow: hidden; color: #eaf8fa; font-size: var(--text-lg); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .row-service { overflow: hidden; color: #91aeb5; font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
    .row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 7px; }
    .status-pill { border-radius: var(--radius-pill); padding: 4px 10px; font-size: var(--text-2xs); font-weight: 700; white-space: nowrap; }
    .status-confirmed { background: #153b36; color: #6fe0b7; }
    .status-pending { background: #41351d; color: #f3cb73; }
    .status-completed { background: #263451; color: #9abaff; }
    .status-cancelled { background: #45262b; color: #ff9da5; }
    .status-no-show { background: #3d2a33; color: #ffb3c2; }
    .origin-badge { color: #9cb5bb; font-size: var(--text-xs); }
    .row-phone { color: #79deeb; font-size: var(--text-xs); font-weight: 600; text-decoration: none; white-space: nowrap; }
    .row-phone:hover { text-decoration: underline; }
    .row-email { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
    .row-end { display: grid; justify-items: end; gap: 8px; }
    .row-price { color: #eaf8fa; font-size: var(--text-lg); font-weight: 700; white-space: nowrap; }
    .row-actions { display: flex; max-width: 300px; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .row-action { min-height: 34px; padding: 0 13px; font-size: var(--text-xs); white-space: nowrap; }
    .row-action--danger { border-color: #8d4c55; color: #ffb5bc; }
    .row-action--danger:hover { border-color: #ff8b95; color: #ffd7da; }
    .row-action--muted { color: #a9c4cb; }
    @media (max-width: 640px) {
      .appointment-row { grid-template-columns: 60px 34px minmax(0, 1fr); column-gap: 10px; padding: 13px 2px; }
      .row-time strong { font-size: var(--text-lg); }
      .avatar { width: 34px; height: 34px; font-size: var(--text-xs); }
      .row-name { font-size: var(--text-md); }
      .row-end { grid-column: 2 / -1; grid-row: 2; justify-items: start; margin-top: 10px; }
      .row-actions { justify-content: flex-start; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentRow {
  readonly appointment = input.required<Appointment>();
  readonly flagged = input(false);
  readonly statusChange = output<AppointmentStatus>();
  readonly reschedule = output<void>();

  protected canManage(): boolean {
    const status = this.appointment().status;
    return status === 'Pendiente' || status === 'Confirmada';
  }

  protected initials(): string {
    return this.appointment().client.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  protected phoneLabel(): string | null {
    const raw = this.appointment().phone?.replace(/\D/g, '');
    if (!raw) return null;
    if (raw.length === 10 && raw.startsWith('3')) {
      return `+57 ${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
    }
    return raw.length > 10 ? `+${raw}` : raw;
  }

  protected endLabel(): string {
    const appointment = this.appointment();
    if (appointment.endTime) return `hasta ${appointment.endTime}`;
    const [hours, minutes] = appointment.time.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || !appointment.durationMinutes) return 'sin fin';
    const total = hours * 60 + minutes + appointment.durationMinutes;
    const endHours = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const endMinutes = String(total % 60).padStart(2, '0');
    return `hasta ${endHours}:${endMinutes}`;
  }

  protected actionLabel(): string | null {
    switch (this.appointment().status) {
      case 'Pendiente': return 'Confirmar';
      case 'Confirmada': return 'Completar';
      default: return null;
    }
  }

  protected advance(): void {
    this.statusChange.emit(this.appointment().status === 'Pendiente' ? 'Confirmada' : 'Completada');
  }
}

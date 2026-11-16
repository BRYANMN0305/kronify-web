import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, input, output } from '@angular/core';

import { DatetimeService } from '../../../core/datetime/datetime.service';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';

/** Detalle operativo de una cita con las acciones disponibles para su estado. */
@Component({
  selector: 'app-appointment-detail-dialog',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="appointment-detail-backdrop" role="presentation" (click)="onBackdropClick($event)">
      <section class="appointment-detail" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
        <header class="appointment-detail-head">
          <div>
            <span class="appointment-detail-eyebrow">Detalle de la cita</span>
            <h2 id="appointment-detail-title">{{ appointment().client }}</h2>
          </div>
          <button class="appointment-detail-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
        </header>

        <div class="appointment-detail-body">
          <div class="appointment-detail-status">
            <span [class]="'status-pill ' + statusClass(appointment().status)">{{ appointment().status }}</span>
            @if (appointment().origin === 'PUBLIC') { <span class="appointment-detail-origin">Reserva en línea</span> }
          </div>

          <dl class="appointment-detail-list">
            <div><dt>Servicio</dt><dd>{{ appointment().service }}</dd></div>
            <div><dt>Profesional</dt><dd>{{ appointment().employee }}</dd></div>
            <div><dt>Fecha</dt><dd>{{ appointment().dateKey || '—' }}</dd></div>
            <div><dt>Horario</dt><dd>{{ appointment().time }}@if (appointment().endTime) { – {{ appointment().endTime }} }</dd></div>
            @if (appointment().durationMinutes > 0) { <div><dt>Duración</dt><dd>{{ appointment().durationMinutes }} min</dd></div> }
            @if (appointment().price !== undefined) { <div><dt>Valor</dt><dd>{{ appointment().price | currency:'COP':'symbol':'1.0-0':'es-CO' }}</dd></div> }
            @if (appointment().phone) { <div><dt>Teléfono</dt><dd><a [href]="'tel:' + appointment().phone">{{ appointment().phone }}</a></dd></div> }
            @if (appointment().email) { <div><dt>Correo</dt><dd><a [href]="'mailto:' + appointment().email">{{ appointment().email }}</a></dd></div> }
          </dl>
          @if (appointment().description) { <p class="appointment-detail-note">{{ appointment().description }}</p> }
        </div>

        <footer class="appointment-detail-actions">
          @if (appointment().status === 'Pendiente') {
            <button class="btn-kronify" type="button" (click)="statusChange.emit('Confirmada')">Confirmar cita</button>
          }
          @if (appointment().status === 'Confirmada') {
            <button class="btn-kronify" type="button" (click)="statusChange.emit('Completada')">Marcar completada</button>
          }
          @if (canManage()) {
            <button class="btn-kronify-outline" type="button" (click)="reschedule.emit()">Reprogramar</button>
            <button class="btn-kronify-outline appointment-detail-danger" type="button" (click)="statusChange.emit('Cancelada')">Cancelar</button>
          }
          @if (canMarkNoShow()) {
            <button class="btn-kronify-outline" type="button" (click)="statusChange.emit('No asistió')">No asistió</button>
          }
        </footer>
      </section>
    </div>
  `,
  styles: [`
    .appointment-detail-backdrop{position:fixed;inset:0;z-index:var(--z-modal);display:grid;place-items:center;background:#02090cb8;padding:20px}
    .appointment-detail{width:min(100%,580px);overflow:hidden;border:1px solid #315d69;border-radius:16px;background:#102a32;color:#eef9fb;box-shadow:0 26px 70px #000a}
    .appointment-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid #244650;padding:21px 23px 17px}
    .appointment-detail-eyebrow{color:#78bcc9;font-size:var(--text-xs);font-weight:800;letter-spacing:.08em;text-transform:uppercase}.appointment-detail h2{margin:5px 0 0;font-size:var(--text-2xl)}
    .appointment-detail-close{display:grid;place-items:center;width:34px;min-height:34px;padding:0;border:1px solid #315d69;border-radius:50%;background:#173b45;color:#fff;font-size:22px;line-height:1}
    .appointment-detail-body{padding:20px 23px}.appointment-detail-status{display:flex;gap:8px;margin-bottom:18px}.appointment-detail-origin{border:1px solid #2b6471;border-radius:999px;padding:4px 8px;color:#8bddea;font-size:var(--text-xs);font-weight:700}
    .appointment-detail-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px;margin:0}.appointment-detail-list div{min-width:0}.appointment-detail-list dt{margin-bottom:3px;color:#83a5ad;font-size:var(--text-xs)}.appointment-detail-list dd{margin:0;color:#f1fbfc;font-size:var(--text-md);font-weight:650;overflow-wrap:anywhere}.appointment-detail-list a{color:#71dceb}
    .appointment-detail-note{margin:18px 0 0;border-left:2px solid #35bfd7;padding-left:11px;color:#abc5ca;font-size:var(--text-sm);line-height:1.5}.appointment-detail-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;border-top:1px solid #244650;padding:16px 23px}.appointment-detail-actions button{min-height:40px;font-size:var(--text-sm)}.appointment-detail-danger{border-color:#b35c67;color:#ffc1c7}
    @media(max-width:560px){.appointment-detail-backdrop{padding:10px}.appointment-detail-head,.appointment-detail-body{padding-inline:16px}.appointment-detail-list{grid-template-columns:1fr}.appointment-detail-actions{padding:14px 16px}.appointment-detail-actions button{width:100%}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetailDialog {
  private readonly datetime = inject(DatetimeService);
  readonly appointment = input.required<Appointment>();
  readonly closed = output<void>();
  readonly statusChange = output<AppointmentStatus>();
  readonly reschedule = output<void>();

  protected canManage(): boolean {
    return this.appointment().status === 'Pendiente' || this.appointment().status === 'Confirmada';
  }

  /** Solo una cita confirmada y ya vencida puede marcarse como no asistida. */
  protected canMarkNoShow(): boolean {
    const appointment = this.appointment();
    if (appointment.status !== 'Confirmada' || !appointment.startAt) return false;

    const startsAt = this.datetime.fromLocal(appointment.startAt);
    let endsAt = startsAt.add(appointment.durationMinutes > 0 ? appointment.durationMinutes : 0, 'minute');
    if (appointment.endTime) {
      const [hour, minute] = appointment.endTime.split(':').map(Number);
      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        endsAt = startsAt.hour(hour).minute(minute).second(0);
        if (!endsAt.isAfter(startsAt)) endsAt = endsAt.add(1, 'day');
      }
    }
    return this.datetime.now().isAfter(endsAt);
  }

  protected statusClass(status: AppointmentStatus): string {
    return ({ Pendiente: 'status-pending', Confirmada: 'status-confirmed', Completada: 'status-completed', Cancelada: 'status-cancelled', 'No asistió': 'status-no-show' })[status];
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.closed.emit(); }
}

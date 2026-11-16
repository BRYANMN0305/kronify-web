import { ChangeDetectionStrategy, Component, computed, HostListener, input, output } from '@angular/core';

import type { ClientAppointment, ClientAppointmentStatus } from '../models/client-appointment.model';

const STATUS_LABELS: Record<ClientAppointmentStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

const DAY_LABEL = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Lista las citas del cliente para el día elegido en el calendario. */
@Component({
  selector: 'app-client-day-dialog',
  standalone: true,
  template: `
    <div class="client-day-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="closed.emit()" tabindex="-1">
      <section class="client-day" role="dialog" aria-modal="true" aria-labelledby="client-day-title">
        <header class="client-day-head">
          <div>
            <span class="client-day-eyebrow">TUS CITAS</span>
            <h2 id="client-day-title">{{ dateLabel() }}</h2>
            <p>{{ appointments().length }} {{ appointments().length === 1 ? 'cita' : 'citas' }}</p>
          </div>
          <div class="client-day-nav">
            <button class="btn-kronify-outline client-day-arrow" type="button" aria-label="Día anterior" (click)="dayShift.emit(-1)">‹</button>
            <button class="btn-kronify-outline client-day-arrow" type="button" aria-label="Día siguiente" (click)="dayShift.emit(1)">›</button>
            <button class="client-day-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
          </div>
        </header>

        <div class="client-day-list">
          @for (appointment of appointments(); track appointment.id) {
            <button class="client-day-item" type="button" (click)="selected.emit(appointment)">
              <span class="client-day-time">{{ timeLabel(appointment.startAt) }}</span>
              <span class="client-day-copy">
                <strong>{{ appointment.serviceName }}</strong>
                <small>{{ appointment.employeeName }} · {{ appointment.serviceDurationMinutes }} min</small>
              </span>
              <span class="client-day-status" [class]="statusClass(appointment.status)">{{ statusLabel(appointment.status) }}</span>
            </button>
          } @empty {
            <p class="client-day-empty">No tienes citas para este día.</p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .client-day-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; background: #061115d1; padding: 18px; backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .client-day { display: flex; width: min(100%, var(--modal-md)); max-height: 88vh; flex-direction: column; overflow: hidden; border: 1px solid #31535d; border-radius: var(--radius-xl); background: #10252c; color: #eff9fb; box-shadow: 0 26px 80px #0009; }
    .client-day-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #23414b; padding: 20px 22px; }
    .client-day-eyebrow { color: #39d6f1; font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.14em; }
    .client-day-head h2 { margin: 5px 0 2px; color: #fff; font-size: var(--text-2xl); font-weight: 700; }
    .client-day-head p { margin: 0; color: #9cb5bb; font-size: var(--text-sm); }
    .client-day-nav { display: flex; align-items: center; gap: 8px; }
    .client-day-arrow { display: grid; width: 36px; height: 36px; place-items: center; padding: 0; font-size: var(--text-2xl); line-height: 1; }
    .client-day-close { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid var(--btn-border); border-radius: var(--btn-radius); background: transparent; color: var(--neon); font-size: var(--text-3xl); line-height: 1; cursor: pointer; }
    .client-day-close:hover { border-color: var(--neon); background: rgba(var(--color-primary-rgb), 0.22); }
    .client-day-list { display: grid; gap: 8px; overflow: auto; overscroll-behavior: contain; padding: 16px 22px 22px; }
    .client-day-item { display: grid; grid-template-columns: 78px minmax(0, 1fr) auto; align-items: center; gap: 14px; width: 100%; border: 1px solid #274952; border-radius: var(--radius-lg); background: #122c34; padding: 13px 14px; color: #eff9fb; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .client-day-item:hover { border-color: #3b8493; background: #173640; }
    .client-day-time { color: #fff; font-size: var(--text-xl); font-weight: 700; }
    .client-day-copy { display: grid; min-width: 0; gap: 2px; }
    .client-day-copy strong { overflow: hidden; color: #eaf8fa; font-size: var(--text-md); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .client-day-copy small { color: #91aeb5; font-size: var(--text-xs); }
    .client-day-status { border-radius: var(--radius-pill); padding: 4px 9px; font-size: var(--text-2xs); font-weight: 700; white-space: nowrap; }
    .client-day-status.is-pending { background: #41351d; color: #f3cb73; }
    .client-day-status.is-confirmed { background: #153b36; color: #6fe0b7; }
    .client-day-status.is-completed { background: #263451; color: #9abaff; }
    .client-day-status.is-cancelled { background: #45262b; color: #ff9da5; }
    .client-day-empty { margin: 10px 0; color: #9cb5bb; font-size: var(--text-base); text-align: center; }
    @media (max-width: 640px) {
      .client-day-backdrop { padding: 10px; }
      .client-day-head { flex-wrap: wrap; padding: 16px; }
      .client-day-list { padding: 12px 16px 18px; }
      .client-day-item { grid-template-columns: 66px minmax(0, 1fr); }
      .client-day-status { grid-column: 2; justify-self: start; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDayDialog {
  readonly date = input.required<Date>();
  readonly appointments = input.required<readonly ClientAppointment[]>();
  readonly closed = output<void>();
  readonly dayShift = output<number>();
  readonly selected = output<ClientAppointment>();

  protected readonly dateLabel = computed(() => {
    const label = DAY_LABEL.format(this.date());
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected statusLabel(status: ClientAppointmentStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusClass(status: ClientAppointmentStatus): string {
    switch (status) {
      case 'PENDING': return 'is-pending';
      case 'CONFIRMED': return 'is-confirmed';
      case 'COMPLETED': return 'is-completed';
      default: return 'is-cancelled';
    }
  }

  protected timeLabel(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  /** Cierra solo cuando el clic cae fuera del panel. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}

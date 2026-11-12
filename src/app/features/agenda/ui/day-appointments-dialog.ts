import { ChangeDetectionStrategy, Component, computed, effect, HostListener, input, output, signal } from '@angular/core';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';
import { AppointmentRow } from './appointment-row';

const DAY_LABEL = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const MONEY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** Muestra en una ventana las citas y los datos del día elegido en el calendario. */
@Component({
  selector: 'app-day-appointments-dialog', standalone: true,
  imports: [AppointmentRow],
  template: `
    <div class="day-dialog-backdrop" (click)="closed.emit()">
      <section class="day-dialog" role="dialog" aria-modal="true" aria-labelledby="day-dialog-title" (click)="$event.stopPropagation()">
        <header class="day-dialog-head">
          <div class="day-dialog-heading">
            <span class="day-dialog-eyebrow">Citas del día</span>
            <h2 id="day-dialog-title">{{ dateLabel() }}</h2>
            <p class="day-dialog-meta">
              {{ appointments().length }} {{ appointments().length === 1 ? 'cita' : 'citas' }}
              <span aria-hidden="true">·</span> {{ durationLabel() }} en total
              <span aria-hidden="true">·</span> {{ totalLabel() }}
            </p>
          </div>
          <div class="day-dialog-nav">
            <button type="button" class="btn-kronify-outline day-dialog-nav-btn" aria-label="Día anterior" (click)="dayShift.emit(-1)">‹</button>
            <button type="button" class="btn-kronify-outline day-dialog-nav-btn" aria-label="Día siguiente" (click)="dayShift.emit(1)">›</button>
            <button type="button" class="day-dialog-close" aria-label="Cerrar" (click)="closed.emit()">×</button>
          </div>
        </header>

        @if (duplicateGroups().length) {
          <div class="day-dialog-warning" role="status">
            <span class="day-dialog-warning-icon" aria-hidden="true">!</span>
            <p>
              <strong>{{ duplicateGroups().length }} {{ duplicateGroups().length === 1 ? 'posible cita duplicada' : 'posibles citas duplicadas' }}</strong>
              <span>Mismo cliente y servicio en el día.</span>
            </p>
            <button type="button" class="btn-kronify-outline day-dialog-review" (click)="toggleReview()">
              {{ reviewing() ? 'Ocultar' : 'Revisar' }}
            </button>
          </div>
        }

        <div class="day-dialog-list">
          @for (appointment of appointments(); track appointment.id) {
            <app-appointment-row
              [appointment]="appointment"
              [flagged]="flaggedIds().has(appointment.id)"
              (statusChange)="statusChange.emit({ id: appointment.id, status: $event })" />
          } @empty {
            <p class="day-dialog-empty">No hay citas para este día.</p>
          }
        </div>

        <footer class="day-dialog-foot">
          <span class="day-dialog-foot-label">Total del día</span>
          <strong class="day-dialog-foot-total">{{ totalLabel() }}</strong>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .day-dialog-backdrop { position: fixed; inset: 0; z-index: 1040; display: grid; place-items: center; background: #061115cc; padding: 18px; backdrop-filter: blur(3px); }
    .day-dialog { display: flex; width: min(100%, 820px); max-height: 90vh; flex-direction: column; overflow: hidden; border: 1px solid #31535d; border-radius: 18px; background: #10252c; color: #eff9fb; box-shadow: 0 24px 80px #0008; animation: day-dialog-in 0.2s ease both; }
    @keyframes day-dialog-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }

    .day-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #23414b; padding: 22px 24px; }
    .day-dialog-heading { display: grid; gap: 3px; min-width: 0; }
    .day-dialog-eyebrow { color: #39d6f1; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
    .day-dialog h2 { margin: 2px 0 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .day-dialog-meta { margin: 0; color: #9cb5bb; font-size: 12px; }
    .day-dialog-meta span { margin: 0 2px; color: #4d7681; }

    .day-dialog-nav { display: flex; flex: none; align-items: center; gap: 8px; }
    .day-dialog-nav-btn { display: grid; width: 36px; height: 36px; place-items: center; padding: 0; font-size: 22px; line-height: 1; }
    .day-dialog-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 1px solid var(--btn-border); border-radius: var(--btn-radius); background: transparent; color: var(--neon); font-size: 24px; line-height: 1; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .day-dialog-close:hover { border-color: var(--neon); background: rgba(var(--color-primary-rgb), 0.22); }

    .day-dialog-warning { display: flex; align-items: center; gap: 12px; margin: 16px 24px 0; border: 1px solid #6b5a2a; border-radius: 12px; background: #2c2717; padding: 12px 14px; }
    .day-dialog-warning-icon { display: grid; width: 26px; height: 26px; flex: none; place-items: center; border-radius: 50%; background: #4a3d1a; color: #f3cb73; font-size: 13px; font-weight: 800; }
    .day-dialog-warning p { display: grid; flex: 1; gap: 1px; margin: 0; min-width: 0; }
    .day-dialog-warning strong { color: #f3cb73; font-size: 12px; font-weight: 700; }
    .day-dialog-warning span { color: #b9a97f; font-size: 11px; }
    .day-dialog-review { min-height: 32px; padding: 0 13px; font-size: 11px; white-space: nowrap; }

    .day-dialog-list { flex: 1; min-height: 0; overflow: auto; padding: 8px 24px; }
    .day-dialog-list app-appointment-row + app-appointment-row { border-top: 1px solid #1d3841; }
    .day-dialog-empty { padding: 32px 0; color: #9cb5bb; text-align: center; }

    .day-dialog-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-top: 1px solid #23414b; background: #0d2128; padding: 16px 24px; }
    .day-dialog-foot-label { color: #8aa8b0; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
    .day-dialog-foot-total { color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }

    @media (max-width: 600px) {
      .day-dialog-backdrop { padding: 10px; }
      .day-dialog { max-height: 94vh; }
      .day-dialog-head { flex-wrap: wrap; padding: 16px; }
      .day-dialog h2 { font-size: 19px; }
      .day-dialog-warning { margin: 12px 16px 0; flex-wrap: wrap; }
      .day-dialog-list { padding: 6px 14px; }
      .day-dialog-foot { padding: 13px 16px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayAppointmentsDialog {
  readonly date = input.required<Date>();
  readonly appointments = input.required<readonly Appointment[]>();
  readonly closed = output<void>();
  readonly dayShift = output<number>();
  readonly statusChange = output<{ id: number; status: AppointmentStatus }>();

  protected readonly reviewing = signal(false);

  protected readonly dateLabel = computed(() => {
    const label = DAY_LABEL.format(this.date());
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected readonly totalMinutes = computed(() =>
    this.appointments().reduce((sum, appointment) => sum + (appointment.durationMinutes || 0), 0));

  protected readonly totalPrice = computed(() =>
    this.appointments()
      .filter((appointment) => appointment.status !== 'Cancelada')
      .reduce((sum, appointment) => sum + (appointment.price ?? 0), 0));

  protected readonly totalLabel = computed(() => MONEY.format(this.totalPrice()));

  protected readonly durationLabel = computed(() => {
    const minutes = this.totalMinutes();
    if (minutes < 60) return `${minutes} min`;
    return `${NUMBER.format(Math.round((minutes / 60) * 10) / 10)} h`;
  });

  /** Citas repetidas del mismo cliente y servicio, sin contar las canceladas. */
  protected readonly duplicateGroups = computed(() => {
    const groups = new Map<string, number[]>();
    for (const appointment of this.appointments()) {
      if (appointment.status === 'Cancelada') continue;
      const key = `${appointment.client.trim().toLowerCase()}|${appointment.service.trim().toLowerCase()}`;
      const ids = groups.get(key) ?? [];
      ids.push(appointment.id);
      groups.set(key, ids);
    }
    return [...groups.values()].filter((ids) => ids.length > 1);
  });

  protected readonly duplicates = computed(() => this.duplicateGroups().flat());

  protected readonly flaggedIds = computed(() => new Set(this.reviewing() ? this.duplicates() : []));

  private lastDateKey = '';

  constructor() {
    effect(() => {
      const key = this.date().toDateString();
      if (key === this.lastDateKey) return;
      this.lastDateKey = key;
      this.reviewing.set(false);
    });
  }

  protected toggleReview(): void {
    this.reviewing.update((value) => !value);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}

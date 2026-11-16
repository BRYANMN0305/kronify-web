import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import type { TimeSlotResponse } from '../../../core/api/openapi/model/timeSlotResponse';
import { DatetimeService } from '../../../core/datetime/datetime.service';
import { AgendaStore } from '../data/agenda.store';
import type { Appointment } from '../modelos/appointment.model';

/** Reprograma una cita del negocio consultando la disponibilidad real del servicio. */
@Component({
  selector: 'app-reschedule-dialog',
  standalone: true,
  template: `
    <div class="reschedule-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="closed.emit()" tabindex="-1">
      <section class="reschedule-dialog" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
        <header class="reschedule-head">
          <div>
            <span class="reschedule-eyebrow">AGENDA</span>
            <h2 id="reschedule-title">Reprogramar cita</h2>
            <p>{{ appointment().client }} · {{ appointment().service }} · {{ appointment().employee }}</p>
          </div>
          <button class="reschedule-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
        </header>

        <div class="reschedule-body">
          <div class="reschedule-summary">
            <div><span>Fecha actual</span><strong>{{ longDate(appointment().startAt) }}</strong></div>
            <div><span>Hora actual</span><strong>{{ appointment().time }}</strong></div>
          </div>

          @if (!canReschedule()) {
            <p class="reschedule-hint">Esta cita no tiene servicio o profesional asociado, así que no se puede reprogramar.</p>
          } @else {
            <label class="reschedule-label" for="reschedule-date">Nueva fecha</label>
            <input id="reschedule-date" class="reschedule-input" type="date" [min]="today" [value]="newDate()" (input)="changeDate($any($event.target).value)">

            <button class="btn-kronify-outline reschedule-secondary" type="button" [disabled]="loadingSlots()" (click)="loadSlots()">
              {{ loadingSlots() ? 'Consultando…' : 'Buscar horarios disponibles' }}
            </button>

            @if (loadingSlots()) {
              <p class="reschedule-hint">Consultando disponibilidad…</p>
            } @else if (slots().length) {
              <p class="reschedule-hint">Selecciona el nuevo horario:</p>
              <div class="reschedule-slots">
                @for (slot of slots(); track slot.startAt) {
                  <button type="button" class="reschedule-slot" [class.is-selected]="newStartAt() === slot.startAt" (click)="newStartAt.set(slot.startAt ?? '')">
                    {{ slotLabel(slot.startAt) }}
                  </button>
                }
              </div>
            } @else if (slotsLoaded()) {
              <p class="reschedule-hint">No hay horarios disponibles para esa fecha.</p>
            }
          }

          @if (error()) { <p class="reschedule-error" role="alert">{{ error() }}</p> }
        </div>

        <footer class="reschedule-foot">
          <button class="btn-kronify-outline reschedule-cancel" type="button" [disabled]="saving()" (click)="closed.emit()">Cancelar</button>
          <button class="btn-kronify reschedule-save" type="button" [disabled]="saving() || !newStartAt()" (click)="save()">
            {{ saving() ? 'Reprogramando…' : 'Guardar nuevo horario' }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .reschedule-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; background: #061115d1; padding: 18px; backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .reschedule-dialog { display: flex; width: min(100%, var(--modal-md)); max-height: 90vh; flex-direction: column; overflow: hidden; border: 1px solid #31535d; border-radius: var(--radius-xl); background: #10252c; color: #eff9fb; box-shadow: 0 26px 80px #0009; animation: reschedule-in 0.18s ease both; }
    @keyframes reschedule-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
    .reschedule-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #23414b; padding: 20px 22px; }
    .reschedule-eyebrow { color: #39d6f1; font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.14em; }
    .reschedule-head h2 { margin: 4px 0 2px; color: #fff; font-size: var(--text-2xl); font-weight: 700; }
    .reschedule-head p { margin: 0; color: #9cb5bb; font-size: var(--text-sm); }
    .reschedule-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 1px solid var(--btn-border); border-radius: var(--btn-radius); background: transparent; color: var(--neon); font-size: var(--text-3xl); line-height: 1; cursor: pointer; }
    .reschedule-close:hover { border-color: var(--neon); background: rgba(var(--color-primary-rgb), 0.22); }
    .reschedule-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 18px 22px; }
    .reschedule-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .reschedule-summary div { display: grid; gap: 3px; border: 1px solid #2b4d57; border-radius: var(--radius-md); background: #183a44; padding: 9px 12px; }
    .reschedule-summary span { color: #87a7af; font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .reschedule-summary strong { color: #e8f7fa; font-size: var(--text-base); font-weight: 600; }
    .reschedule-label { display: block; margin: 14px 0 6px; color: #b9d4da; font-size: var(--text-xs); font-weight: 700; }
    .reschedule-input { width: 100%; height: 42px; border: 1px solid #3a626e; border-radius: var(--radius-md); background: #1e3d49; color: #e8f7fa; padding: 0 12px; font-size: var(--text-base); }
    .reschedule-input:focus { border-color: var(--neon); outline: none; }
    .reschedule-secondary { width: 100%; min-height: 40px; margin-top: 10px; font-size: var(--text-sm); }
    .reschedule-hint { margin: 10px 0 0; color: #9cb5bb; font-size: var(--text-sm); line-height: 1.45; }
    .reschedule-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; margin-top: 10px; }
    .reschedule-slot { border: 1px solid #3a626e; border-radius: var(--radius-md); background: #1e3d49; color: #d5f0f7; padding: 9px 6px; font-size: var(--text-sm); font-weight: 700; cursor: pointer; }
    .reschedule-slot:hover { border-color: #3fe1ff9e; }
    .reschedule-slot.is-selected { border-color: var(--neon); background: var(--neon); color: #06232c; }
    .reschedule-error { margin: 12px 0 0; border: 1px solid #6b333a; border-radius: var(--radius-md); background: #2c191d; padding: 10px 12px; color: #ffb5bc; font-size: var(--text-sm); }
    .reschedule-foot { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #23414b; background: #0d2128; padding: 16px 22px; }
    .reschedule-cancel, .reschedule-save { min-height: 42px; padding: 0 16px; font-size: var(--text-sm); }
    @media (max-width: 640px) {
      .reschedule-backdrop { padding: 10px; }
      .reschedule-head { padding: 16px; }
      .reschedule-body { padding: 14px 16px; }
      .reschedule-summary { grid-template-columns: 1fr; }
      .reschedule-foot { flex-direction: column-reverse; padding: 13px 16px; }
      .reschedule-cancel, .reschedule-save { width: 100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RescheduleDialog {
  private readonly store = inject(AgendaStore);
  private readonly datetime = inject(DatetimeService);

  readonly appointment = input.required<Appointment>();
  readonly closed = output<void>();
  readonly rescheduled = output<Appointment>();

  protected readonly today = this.datetime.now().format('YYYY-MM-DD');
  protected readonly newDate = linkedSignal(() => this.appointment().startAt?.slice(0, 10) || this.today);
  protected readonly newStartAt = signal('');
  protected readonly slots = signal<readonly TimeSlotResponse[]>([]);
  protected readonly slotsLoaded = signal(false);
  protected readonly loadingSlots = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canReschedule = computed(() =>
    this.appointment().serviceId != null && this.appointment().employeeId != null);

  protected longDate(value?: string): string {
    if (!value) return '—';
    return this.datetime.fromLocal(value).toDate().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  protected slotLabel(value?: string): string {
    if (!value) return '—';
    return this.datetime.fromLocal(value).toDate().toLocaleTimeString('es-CO', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  protected changeDate(value: string): void {
    this.newDate.set(value);
    this.newStartAt.set('');
    this.slots.set([]);
    this.slotsLoaded.set(false);
    this.error.set(null);
  }

  protected async loadSlots(): Promise<void> {
    const appointment = this.appointment();
    if (appointment.serviceId == null) return;
    this.loadingSlots.set(true);
    this.error.set(null);
    this.newStartAt.set('');
    try {
      const result = await this.store.availability(
        appointment.serviceId,
        this.newDate(),
        appointment.employeeId ?? undefined,
      );
      this.slots.set((result.slots ?? []).filter((slot) => slot.startAt !== appointment.startAt));
      this.slotsLoaded.set(true);
    } catch (error) {
      this.error.set(this.errorMessage(error));
      this.slots.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
  }

  protected async save(): Promise<void> {
    const startAt = this.newStartAt();
    if (!startAt) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.store.reschedule(this.appointment().id, startAt);
      if (!updated) {
        this.error.set('No se pudo reprogramar la cita. Intenta con otro horario.');
        return;
      }
      this.rescheduled.emit(updated);
      this.closed.emit();
    } finally {
      this.saving.set(false);
    }
  }

  /** Cierra solo cuando el clic cae fuera del panel, sin detener la propagación dentro. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown; detail?: unknown; title?: unknown } | string | null;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const message = body.message ?? body.detail ?? body.title;
        if (typeof message === 'string' && message.trim()) return message;
      }
      return `No se pudo consultar la disponibilidad (error ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}

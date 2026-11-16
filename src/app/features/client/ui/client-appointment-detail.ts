import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import type { TimeSlotResponse } from '../../../core/api/openapi/model/timeSlotResponse';
import { DatetimeService } from '../../../core/datetime/datetime.service';
import { ClientAppointmentsStore } from '../data/client-appointments.store';
import type { ClientAppointment, ClientAppointmentStatus } from '../models/client-appointment.model';

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

/** Detalle de una cita del cliente: información, reprogramación y cancelación. */
@Component({
  selector: 'app-client-appointment-detail',
  standalone: true,
  template: `
    <div class="client-dialog-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="closed.emit()" tabindex="-1">
      <section class="client-dialog" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title">
        <header class="client-dialog-head">
          <div>
            <span class="client-dialog-eyebrow">TU CITA</span>
            <h2 id="client-dialog-title">{{ appointment().serviceName }}</h2>
            <p>{{ appointment().employeeName }}</p>
          </div>
          <button class="client-dialog-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
        </header>

        <div class="client-dialog-body">
          <section class="client-dialog-section" aria-labelledby="client-dialog-info">
            <h3 id="client-dialog-info"><span class="section-dot"></span> Información de la cita</h3>
            <div class="client-dialog-grid">
              <div class="client-field"><span class="field-label">Servicio</span><strong>{{ appointment().serviceName }}</strong></div>
              <div class="client-field"><span class="field-label">Profesional</span><strong>{{ appointment().employeeName }}</strong></div>
              <div class="client-field"><span class="field-label">Fecha</span><strong>{{ longDate(appointment().startAt) }}</strong></div>
              <div class="client-field"><span class="field-label">Hora</span><strong>{{ timeLabel(appointment().startAt) }}</strong></div>
              <div class="client-field"><span class="field-label">Duración</span><strong>{{ appointment().serviceDurationMinutes }} min</strong></div>
              <div class="client-field">
                <span class="field-label">Estado</span>
                <strong><span class="client-status" [class]="statusClass()">{{ statusLabel() }}</span></strong>
              </div>
            </div>
          </section>

          @if (error()) { <p class="client-dialog-error" role="alert">{{ error() }}</p> }

          @if (canManage()) {
            <section class="client-dialog-section" aria-labelledby="client-dialog-reschedule">
              <h3 id="client-dialog-reschedule"><span class="section-dot"></span> Reprogramar cita</h3>
              <p class="client-dialog-hint">Elige una nueva fecha y un horario disponible.</p>
              <label class="client-dialog-label" for="client-reschedule-date">Nueva fecha</label>
              <input id="client-reschedule-date" class="client-dialog-input" type="date" [min]="today" [value]="newDate()" (input)="changeDate($any($event.target).value)">
              <button class="btn-kronify-outline client-dialog-secondary" type="button" [disabled]="loadingSlots()" (click)="loadSlots()">
                {{ loadingSlots() ? 'Consultando…' : 'Buscar horarios disponibles' }}
              </button>

              @if (loadingSlots()) {
                <p class="client-dialog-hint">Consultando disponibilidad…</p>
              } @else if (slots().length) {
                <p class="client-dialog-hint">Selecciona un horario disponible:</p>
                <div class="client-slots">
                  @for (slot of slots(); track slot.startAt) {
                    <button type="button" class="client-slot" [class.is-selected]="newStartAt() === slot.startAt" (click)="newStartAt.set(slot.startAt ?? '')">
                      {{ timeLabel(slot.startAt) }}
                    </button>
                  }
                </div>
              } @else if (slotsLoaded()) {
                <p class="client-dialog-hint">No hay horarios disponibles para esa fecha.</p>
              }

              <button class="btn-kronify client-dialog-primary" type="button" [disabled]="saving() || !newStartAt()" (click)="saveReschedule()">
                {{ saving() ? 'Reprogramando…' : 'Reprogramar cita' }}
              </button>
            </section>

            <section class="client-dialog-section client-dialog-danger" aria-labelledby="client-dialog-cancel">
              <h3 id="client-dialog-cancel"><span class="section-dot"></span> Cancelar cita</h3>
              <p class="client-dialog-hint">Una vez cancelada no podrás revertir la acción.</p>
              <button class="btn-kronify-outline client-dialog-danger-button" type="button" [disabled]="saving()" (click)="cancel()">
                {{ cancelling() ? 'Cancelando…' : 'Cancelar cita' }}
              </button>
            </section>
          } @else {
            <p class="client-dialog-hint">Esta cita ya no se puede modificar.</p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .client-dialog-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; background: #061115d1; padding: 18px; backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .client-dialog { display: flex; width: min(100%, var(--modal-md)); max-height: 90vh; flex-direction: column; overflow: hidden; border: 1px solid #31535d; border-radius: var(--radius-xl); background: #10252c; color: #eff9fb; box-shadow: 0 26px 80px #0009; animation: client-dialog-in 0.18s ease both; }
    @keyframes client-dialog-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
    .client-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #23414b; padding: 20px 22px; }
    .client-dialog-eyebrow { color: #39d6f1; font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.14em; }
    .client-dialog-head h2 { margin: 4px 0 2px; color: #fff; font-size: var(--text-2xl); font-weight: 700; letter-spacing: -0.01em; }
    .client-dialog-head p { margin: 0; color: #9cb5bb; font-size: var(--text-sm); }
    .client-dialog-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 1px solid var(--btn-border); border-radius: var(--btn-radius); background: transparent; color: var(--neon); font-size: var(--text-3xl); line-height: 1; cursor: pointer; }
    .client-dialog-close:hover { border-color: var(--neon); background: rgba(var(--color-primary-rgb), 0.22); }
    .client-dialog-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 8px 22px 22px; }
    .client-dialog-section { margin-top: 14px; border: 1px solid #264650; border-radius: var(--radius-lg); background: #122c34; padding: 16px; }
    .client-dialog-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; color: #3fe1ff; font-size: var(--text-sm); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .section-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #3fe1ff; box-shadow: 0 0 8px #3fe1ffb3; }
    .client-dialog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .client-field { display: grid; gap: 3px; min-width: 0; border: 1px solid #2b4d57; border-radius: var(--radius-md); background: #183a44; padding: 9px 12px; }
    .field-label { color: #87a7af; font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .client-field strong { overflow: hidden; color: #e8f7fa; font-size: var(--text-base); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .client-status { display: inline-flex; border-radius: var(--radius-pill); padding: 3px 9px; font-size: var(--text-2xs); font-weight: 800; }
    .client-status.is-pending { background: #41351d; color: #f3cb73; }
    .client-status.is-confirmed { background: #153b36; color: #6fe0b7; }
    .client-status.is-completed { background: #263451; color: #9abaff; }
    .client-status.is-cancelled { background: #45262b; color: #ff9da5; }
    .client-dialog-hint { margin: 0; color: #9cb5bb; font-size: var(--text-sm); line-height: 1.45; }
    .client-dialog-label { display: block; margin: 12px 0 6px; color: #b9d4da; font-size: var(--text-xs); font-weight: 700; }
    .client-dialog-input { width: 100%; height: 42px; border: 1px solid #3a626e; border-radius: var(--radius-md); background: #1e3d49; color: #e8f7fa; padding: 0 12px; font-size: var(--text-base); }
    .client-dialog-input:focus { border-color: var(--neon); outline: none; }
    .client-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; margin-top: 12px; }
    .client-slot { border: 1px solid #3a626e; border-radius: var(--radius-md); background: #1e3d49; color: #d5f0f7; padding: 9px 6px; font-size: var(--text-sm); font-weight: 700; cursor: pointer; }
    .client-slot:hover { border-color: #3fe1ff9e; }
    .client-slot.is-selected { border-color: var(--neon); background: var(--neon); color: #06232c; }
    .client-dialog-secondary { width: 100%; min-height: 40px; margin-top: 10px; font-size: var(--text-sm); }
    .client-dialog-primary { width: 100%; min-height: 42px; margin-top: 14px; font-size: var(--text-base); }
    .client-dialog-danger { border-color: #5b3036; background: #23181b; }
    .client-dialog-danger-button { width: 100%; min-height: 42px; margin-top: 12px; border-color: #b45762; color: #ffb5bc; font-size: var(--text-base); }
    .client-dialog-danger-button:hover { border-color: #ff8b95; color: #ffd7da; }
    .client-dialog-error { margin: 12px 0 0; border: 1px solid #6b333a; border-radius: var(--radius-md); background: #2c191d; padding: 10px 12px; color: #ffb5bc; font-size: var(--text-sm); }
    @media (max-width: 640px) {
      .client-dialog-backdrop { padding: 10px; }
      .client-dialog { max-height: 94vh; }
      .client-dialog-head { padding: 16px; }
      .client-dialog-body { padding: 6px 16px 16px; }
      .client-dialog-grid { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientAppointmentDetail {
  private readonly store = inject(ClientAppointmentsStore);
  private readonly datetime = inject(DatetimeService);

  readonly appointment = input.required<ClientAppointment>();
  readonly closed = output<void>();
  readonly updated = output<ClientAppointment>();

  protected readonly today = this.datetime.now().format('YYYY-MM-DD');
  protected readonly newDate = linkedSignal(() => this.appointment().startAt.slice(0, 10) || this.today);
  protected readonly newStartAt = signal('');
  protected readonly slots = signal<readonly TimeSlotResponse[]>([]);
  protected readonly slotsLoaded = signal(false);
  protected readonly loadingSlots = signal(false);
  protected readonly saving = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canManage = computed(() =>
    this.appointment().status === 'PENDING' || this.appointment().status === 'CONFIRMED');

  protected statusLabel(): string {
    return STATUS_LABELS[this.appointment().status];
  }

  protected statusClass(): string {
    return STATUS_CLASSES[this.appointment().status];
  }

  protected longDate(value: string): string {
    if (!value) return '—';
    return this.datetime.fromLocal(value).toDate().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  protected timeLabel(value?: string): string {
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
    if (appointment.businessId == null || appointment.serviceId == null || appointment.employeeId == null) {
      this.error.set('Esta cita no tiene los datos necesarios para consultar disponibilidad.');
      return;
    }
    this.loadingSlots.set(true);
    this.error.set(null);
    this.newStartAt.set('');
    try {
      const result = await this.store.availability(
        appointment.businessId, appointment.serviceId, this.newDate(), appointment.employeeId,
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

  protected async saveReschedule(): Promise<void> {
    const startAt = this.newStartAt();
    if (!startAt) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.store.reschedule(this.appointment(), startAt);
      this.updated.emit(updated);
      this.closed.emit();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    this.cancelling.set(true);
    this.error.set(null);
    try {
      const success = await this.store.cancel(this.appointment().id);
      if (!success) {
        this.error.set('No se pudo cancelar la cita. Intenta de nuevo.');
        return;
      }
      this.closed.emit();
    } finally {
      this.cancelling.set(false);
    }
  }

  /** Cierra solo cuando el clic cae fuera del panel. */
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
      return `No se pudo completar la operación (error ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}

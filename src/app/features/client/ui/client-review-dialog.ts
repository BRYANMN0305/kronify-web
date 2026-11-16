import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, HostListener, inject, input, output, signal } from '@angular/core';

import { ClientAppointmentsStore } from '../data/client-appointments.store';
import type { ClientAppointment } from '../models/client-appointment.model';

const STARS = [1, 2, 3, 4, 5] as const;

/** Formulario para calificar una cita completada. */
@Component({
  selector: 'app-client-review-dialog',
  standalone: true,
  template: `
    <div class="review-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="closed.emit()" tabindex="-1">
      <section class="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <header class="review-head">
          <div>
            <span class="review-eyebrow">TU OPINIÓN</span>
            <h2 id="review-title">Reseñar {{ appointment().serviceName }}</h2>
            <p>{{ appointment().employeeName }} · {{ dateLabel() }}</p>
          </div>
          <button class="review-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
        </header>

        <form class="review-body" (ngSubmit)="submit()">
          <fieldset class="review-stars">
            <legend>Calificación</legend>
            <div class="stars-row">
              @for (star of stars; track star) {
                <button type="button" class="star-button" [class.is-active]="rating() >= star" [attr.aria-label]="star + ' estrellas'" [attr.aria-pressed]="rating() === star" (click)="rating.set(star)">★</button>
              }
            </div>
          </fieldset>

          <label class="review-field">Comentario
            <textarea rows="4" maxlength="1000" placeholder="Cuéntanos cómo fue tu experiencia" [value]="comment()" (input)="comment.set($any($event.target).value)"></textarea>
          </label>

          @if (error()) { <p class="review-error" role="alert">{{ error() }}</p> }

          <footer class="review-actions">
            <button type="button" class="btn-kronify-outline review-cancel" (click)="closed.emit()" [disabled]="submitting()">Cancelar</button>
            <button type="submit" class="btn-kronify review-submit" [disabled]="submitting()">{{ submitting() ? 'Enviando…' : 'Enviar reseña' }}</button>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .review-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; background: #061115d1; padding: 18px; backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .review-dialog { width: min(100%, var(--modal-sm)); max-height: 92vh; overflow: auto; overscroll-behavior: contain; border: 1px solid #31535d; border-radius: var(--radius-xl); background: #10252c; color: #eff9fb; box-shadow: 0 26px 80px #0009; animation: review-in 0.18s ease both; }
    @keyframes review-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
    .review-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #23414b; padding: 20px 22px; }
    .review-eyebrow { color: #39d6f1; font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.14em; }
    .review-head h2 { margin: 5px 0 3px; color: #fff; font-size: var(--text-2xl); font-weight: 700; }
    .review-head p { margin: 0; color: #9cb5bb; font-size: var(--text-sm); }
    .review-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 1px solid var(--btn-border); border-radius: var(--btn-radius); background: transparent; color: var(--neon); font-size: var(--text-3xl); line-height: 1; cursor: pointer; }
    .review-close:hover { border-color: var(--neon); background: rgba(var(--color-primary-rgb), 0.22); }
    .review-body { display: grid; gap: 16px; padding: 20px 22px 22px; }
    .review-stars { display: grid; gap: 8px; border: 0; margin: 0; padding: 0; }
    .review-stars legend { color: #b9d4da; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .stars-row { display: flex; gap: 5px; }
    .star-button { border: 0; background: transparent; color: #395962; font-size: 32px; line-height: 1; cursor: pointer; transition: color 0.14s, transform 0.14s; }
    .star-button:hover { transform: translateY(-2px); color: #f3cb73; }
    .star-button.is-active { color: #f3cb73; text-shadow: 0 0 12px #f3cb7366; }
    .review-field { display: grid; gap: 6px; color: #b9d4da; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .review-field textarea { width: 100%; border: 1px solid #3a626e; border-radius: var(--radius-md); background: #1e3d49; color: #e8f7fa; padding: 11px 12px; font: 400 var(--text-base)/1.5 var(--font-ui); resize: vertical; }
    .review-field textarea:focus { border-color: var(--neon); outline: none; }
    .review-error { margin: 0; border: 1px solid #6b333a; border-radius: var(--radius-md); background: #2c191d; padding: 10px 12px; color: #ffb5bc; font-size: var(--text-sm); }
    .review-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .review-cancel, .review-submit { min-height: 42px; padding: 0 18px; font-size: var(--text-sm); }
    @media (max-width: 640px) { .review-head, .review-body { padding: 16px; } .review-actions { flex-direction: column-reverse; } .review-cancel, .review-submit { width: 100%; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientReviewDialog {
  private readonly store = inject(ClientAppointmentsStore);

  readonly appointment = input.required<ClientAppointment>();
  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly stars = STARS;
  protected readonly rating = signal(5);
  protected readonly comment = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected dateLabel(): string {
    const value = this.appointment().startAt;
    if (!value) return '—';
    return new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.store.submitReview(this.appointment().id, this.rating(), this.comment());
      this.created.emit();
      this.closed.emit();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.submitting.set(false);
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
      return `No se pudo enviar la reseña (error ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}

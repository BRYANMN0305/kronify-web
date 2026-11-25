import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ReviewControllerService } from '../../../../core/api/openapi/api/reviewController.service';

const STARS = [1, 2, 3, 4, 5] as const;

/** Cita propia que ya puede calificarse desde el perfil público del negocio. */
export interface ReviewableAppointment {
  readonly id: number;
  readonly serviceName: string;
  readonly startAt: string;
}

/**
 * Formulario público de reseña. El backend exige `appointmentId`, así que solo
 * se muestra al cliente autenticado que tiene citas completadas con el negocio.
 */
@Component({
  selector: 'app-public-review-form',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="review-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="closed.emit()" tabindex="-1">
      <section class="review-dialog" role="dialog" aria-modal="true" aria-labelledby="public-review-title">
        <header class="review-head">
          <div>
            <span class="review-eyebrow">TU OPINIÓN</span>
            <h2 id="public-review-title">Reseñar {{ businessName() }}</h2>
            <p>Cuéntanos cómo fue tu experiencia.</p>
          </div>
          <button class="review-close" type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
        </header>

        <form class="review-body" (ngSubmit)="submit()">
          @if (appointments().length > 1) {
            <label class="review-field">Cita
              <select [value]="appointmentId() ?? ''" (change)="selectAppointment($event)">
                @for (appointment of appointments(); track appointment.id) {
                  <option [value]="appointment.id">
                    {{ appointment.serviceName }} · {{ appointment.startAt | date:'d MMM y':'':'es-CO' }}
                  </option>
                }
              </select>
            </label>
          } @else if (appointments()[0]; as appointment) {
            <p class="review-context">{{ appointment.serviceName }} · {{ appointment.startAt | date:'d MMM y':'':'es-CO' }}</p>
          }

          <fieldset class="review-stars">
            <legend>Calificación</legend>
            <div class="stars-row">
              @for (star of stars; track star) {
                <button
                  type="button"
                  class="star-button"
                  [class.is-active]="rating() >= star"
                  [attr.aria-label]="star + ' estrellas'"
                  [attr.aria-pressed]="rating() === star"
                  (click)="rating.set(star)">★</button>
              }
            </div>
          </fieldset>

          <label class="review-field">Comentario
            <textarea
              rows="4"
              maxlength="1000"
              placeholder="Cuéntanos cómo fue tu experiencia"
              [value]="comment()"
              (input)="comment.set($any($event.target).value)"></textarea>
          </label>

          @if (error()) { <p class="review-error" role="alert">{{ error() }}</p> }

          <footer class="review-actions">
            <button type="button" class="review-cancel" (click)="closed.emit()" [disabled]="submitting()">Cancelar</button>
            <button type="submit" class="review-submit" [disabled]="submitting() || appointmentId() == null">
              {{ submitting() ? 'Enviando…' : 'Enviar reseña' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: [`
    :host { font-family: var(--font-ui); }
    .review-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; background: #061115d1; padding: 18px; backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .review-dialog { width: min(100%, var(--modal-sm)); max-height: 92vh; overflow: auto; overscroll-behavior: contain; border: 1px solid #dbe6e9; border-radius: 22px; background: #fff; color: #0f2a33; box-shadow: 0 26px 80px #0009; animation: review-in 0.18s ease both; }
    @keyframes review-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
    .review-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #dbe6e9; padding: 20px 22px; }
    .review-eyebrow { color: #0e7c90; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; }
    .review-head h2 { margin: 5px 0 3px; color: #0f2a33; font-size: 22px; font-weight: 700; }
    .review-head p { margin: 0; color: #5b7580; font-size: 13px; }
    .review-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 1px solid #dbe6e9; border-radius: 10px; background: transparent; color: #31565e; font-size: 24px; line-height: 1; cursor: pointer; }
    .review-close:hover { border-color: #0e7c90; color: #0e7c90; }
    .review-body { display: grid; gap: 16px; padding: 20px 22px 22px; }
    .review-context { margin: 0; border-radius: 10px; background: #e8f5f8; padding: 10px 12px; color: #0e7c90; font-size: 12px; font-weight: 600; }
    .review-stars { display: grid; gap: 8px; border: 0; margin: 0; padding: 0; }
    .review-stars legend { color: #5b7580; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .stars-row { display: flex; gap: 5px; }
    .star-button { border: 0; background: transparent; color: #c7d6da; font-size: 32px; line-height: 1; cursor: pointer; transition: color 0.14s, transform 0.14s; }
    .star-button:hover { transform: translateY(-2px); color: #d99818; }
    .star-button.is-active { color: #d99818; }
    .review-field { display: grid; gap: 6px; color: #5b7580; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .review-field textarea,
    .review-field select { width: 100%; border: 1px solid #c9dade; border-radius: 10px; background: #fbfdfe; color: #0f2a33; padding: 11px 12px; font: 400 14px/1.5 var(--font-ui); }
    .review-field textarea { resize: vertical; }
    .review-field textarea:focus,
    .review-field select:focus { border-color: #0e7c90; outline: none; }
    .review-error { margin: 0; border: 1px solid #e3b4ba; border-radius: 10px; background: #fdf0f1; padding: 10px 12px; color: #8c2f39; font-size: 13px; }
    .review-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .review-cancel,
    .review-submit { min-height: 42px; border-radius: 10px; padding: 0 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .review-cancel { border: 1px solid #c9dade; background: transparent; color: #31565e; }
    .review-submit { border: 0; background: #0e7c90; color: #fff; }
    .review-submit:disabled { opacity: 0.55; cursor: not-allowed; }
    @media (max-width: 640px) { .review-head, .review-body { padding: 16px; } .review-actions { flex-direction: column-reverse; } .review-cancel, .review-submit { width: 100%; } }
    @media (prefers-color-scheme: dark) {
      .review-dialog { border-color: #1f3d47; background: #10272f; color: #e8f4f6; }
      .review-head { border-color: #1f3d47; }
      .review-head h2 { color: #e8f4f6; }
      .review-head p, .review-field, .review-stars legend { color: #8fb0b9; }
      .review-close { border-color: #1f3d47; color: #b7d6dc; }
      .review-context { background: #12323c; color: #5ee0f2; }
      .review-field textarea, .review-field select { border-color: #1f3d47; background: #0d2128; color: #e8f4f6; }
      .star-button { color: #395962; }
      .review-cancel { border-color: #1f3d47; color: #b7d6dc; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicReviewForm {
  private readonly reviewsApi = inject(ReviewControllerService);

  readonly businessName = input.required<string>();
  readonly appointments = input.required<readonly ReviewableAppointment[]>();

  readonly closed = output<void>();
  readonly created = output<number>();

  protected readonly stars = STARS;
  protected readonly rating = signal(5);
  protected readonly comment = signal('');
  protected readonly appointmentId = signal<number | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Mantiene seleccionada la primera cita disponible, incluso si la lista
    // llega después de abrir el diálogo.
    effect(() => {
      const appointments = this.appointments();
      if (appointments.some((appointment) => appointment.id === this.appointmentId())) return;
      this.appointmentId.set(appointments[0]?.id ?? null);
    });
  }

  protected selectAppointment(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.appointmentId.set(Number.isFinite(value) ? value : null);
  }

  protected async submit(): Promise<void> {
    const appointmentId = this.appointmentId();
    if (appointmentId == null) {
      this.error.set('No hay una cita completada que puedas reseñar.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.reviewsApi.createReview({
        appointmentId,
        rating: this.rating(),
        comment: this.comment().trim() || undefined,
      }));
      this.created.emit(appointmentId);
      this.closed.emit();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

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

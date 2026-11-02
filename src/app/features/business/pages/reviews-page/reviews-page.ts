import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ReviewControllerService } from '../../../../core/api/openapi/api/reviewController.service';
import type { ReviewResponse } from '../../../../core/api/openapi/model/reviewResponse';

/** Permite al negocio consultar reseñas y decidir si se publican en su página. */
@Component({
  selector: 'app-reviews-page', standalone: true, imports: [DatePipe],
  templateUrl: './reviews-page.html', styleUrl: './reviews-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsPage implements OnInit {
  private readonly api = inject(ReviewControllerService);
  protected readonly reviews = signal<readonly ReviewResponse[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.busy.set(true); this.error.set(null);
    try {
      const page = await firstValueFrom(this.api.listBusinessReviews({ page: 0, size: 100 }));
      this.reviews.set((page.content ?? []).map((review) => this.normalize(review)));
    } catch {
      this.error.set('No se pudieron cargar las reseñas desde el servidor. Tus cambios no se han eliminado; vuelve a intentarlo.');
    } finally { this.busy.set(false); }
  }

  protected customerName(review: ReviewResponse): string {
    return review.customerName?.trim() || 'Cliente';
  }

  protected comment(review: ReviewResponse): string {
    return review.comment?.trim() || 'El cliente no dejó un comentario.';
  }

  protected rating(review: ReviewResponse): number {
    const value = Number(review.rating);
    return Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value))) : 0;
  }

  protected async toggle(review: ReviewResponse): Promise<void> {
    if (review.reviewId == null) return;
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      const result = this.normalize(await firstValueFrom(this.api.updateVisibility(review.reviewId, { visible: !review.visible })));
      this.reviews.update((items) => items.map((item) => item.reviewId === result.reviewId ? result : item));
      this.notice.set(result.visible ? 'Reseña publicada en el perfil público.' : 'Reseña oculta del perfil público.');
    } catch {
      this.error.set('No se pudo guardar el cambio de visibilidad en el servidor.');
    } finally { this.busy.set(false); }
  }

  private normalize(review: ReviewResponse): ReviewResponse {
    return {
      ...review,
      customerName: review.customerName?.trim() || 'Cliente',
      comment: review.comment?.trim() || 'El cliente no dejó un comentario.',
      rating: this.rating(review),
      visible: review.visible === true,
    };
  }
}

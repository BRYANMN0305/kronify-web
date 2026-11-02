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
      this.reviews.set(page.content ?? []);
    } catch { this.error.set('No se pudieron cargar las reseñas.'); }
    finally { this.busy.set(false); }
  }
  protected async toggle(review: ReviewResponse): Promise<void> {
    if (review.reviewId == null) return;
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      const result = await firstValueFrom(this.api.updateVisibility(review.reviewId, { visible: !review.visible }));
      this.reviews.update((items) => items.map((item) => item.reviewId === result.reviewId ? result : item));
      this.notice.set(result.visible ? 'Reseña publicada en el perfil público.' : 'Reseña oculta del perfil público.');
    } catch { this.error.set('No se pudo cambiar la visibilidad de la reseña.'); }
    finally { this.busy.set(false); }
  }
}

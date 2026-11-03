import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { ReviewResponse } from '../../../../core/api/openapi/model/reviewResponse';
import { PublicBookingWidget } from '../../ui/public-booking-widget/public-booking-widget';

/** Presenta la ficha pública del negocio, sus horarios y reseñas. */
@Component({
  selector: 'app-public-business-page', standalone: true, imports: [DatePipe, PublicBookingWidget],
  templateUrl: './public-business-page.html', styleUrl: './public-business-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBusinessPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicBusinessControllerService);
  protected readonly business = signal<PublicBusinessResponse | null>(null);
  protected readonly slug = signal('');
  protected readonly reviews = signal<readonly ReviewResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) { this.loading.set(false); this.error.set(true); return; }
    this.slug.set(slug);
    void this.load(slug);
  }

  protected hoursFor(index: number): string | null {
    const hours = this.business()?.openingHours?.find((item) => item.dayOfWeek === index + 1);
    return hours?.startTime && hours.endTime ? `${hours.startTime.slice(0, 5)} – ${hours.endTime.slice(0, 5)}` : null;
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [business, reviews] = await Promise.all([
        firstValueFrom(this.api.getBusinessBySlug(slug)),
        firstValueFrom(this.api.getPublicReviews(slug)).catch(() => []),
      ]);
      this.business.set(business);
      this.reviews.set((reviews ?? []).filter((review) => review.visible !== false));
    } catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }
}

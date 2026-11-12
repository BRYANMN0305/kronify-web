import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { PublicServiceResponse } from '../../../../core/api/openapi/model/publicServiceResponse';
import type { ReviewResponse } from '../../../../core/api/openapi/model/reviewResponse';
import { environment } from '../../../../../environments/environment';
import { PublicBookingWidget } from '../../ui/public-booking-widget/public-booking-widget';

/** Presenta la ficha pública del negocio, sus servicios, horarios y reseñas. */
@Component({
  selector: 'app-public-business-page', standalone: true,
  imports: [CurrencyPipe, DatePipe, PublicBookingWidget],
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
  protected readonly logoFailed = signal(false);
  protected readonly bookingOpen = signal(false);
  protected readonly preferredServiceId = signal<number | null>(null);
  protected readonly weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  protected readonly logoUrl = computed(() => this.resolveLogoUrl(this.business()?.logoUrl));
  protected readonly initial = computed(() => (this.business()?.name?.trim().charAt(0) || 'K').toUpperCase());
  protected readonly services = computed<readonly PublicServiceResponse[]>(
    () => this.business()?.services ?? [],
  );

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

  protected openBooking(serviceId?: number): void {
    this.preferredServiceId.set(serviceId ?? null);
    this.bookingOpen.set(true);
  }

  protected closeBooking(): void {
    this.bookingOpen.set(false);
  }

  private resolveLogoUrl(value?: string | null): string | null {
    if (!value) return null;
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    return value.startsWith('/') ? `${environment.apiUrl}${value}` : value;
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

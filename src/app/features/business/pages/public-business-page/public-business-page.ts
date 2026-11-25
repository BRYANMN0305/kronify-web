import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicAppointmentControllerService } from '../../../../core/api/openapi/api/publicAppointmentController.service';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { AppointmentResponse } from '../../../../core/api/openapi/model/appointmentResponse';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { PublicServiceResponse } from '../../../../core/api/openapi/model/publicServiceResponse';
import type { ReviewResponse } from '../../../../core/api/openapi/model/reviewResponse';
import { AuthStore } from '../../../../core/auth/auth.store';
import { environment } from '../../../../../environments/environment';
import { PublicBookingWidget } from '../../ui/public-booking-widget/public-booking-widget';
import { PublicReviewForm } from '../../ui/public-review-form/public-review-form';
import type { ReviewableAppointment } from '../../ui/public-review-form/public-review-form';

/** Presenta la ficha pública del negocio, sus servicios, horarios y reseñas. */
@Component({
  selector: 'app-public-business-page', standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, PublicBookingWidget, PublicReviewForm],
  templateUrl: './public-business-page.html', styleUrl: './public-business-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBusinessPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicBusinessControllerService);
  private readonly appointmentsApi = inject(PublicAppointmentControllerService);
  private readonly auth = inject(AuthStore);
  protected readonly business = signal<PublicBusinessResponse | null>(null);
  protected readonly slug = signal('');
  protected readonly reviews = signal<readonly ReviewResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly logoFailed = signal(false);
  protected readonly bookingOpen = signal(false);
  protected readonly preferredServiceId = signal<number | null>(null);
  protected readonly weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /** Reseñas creadas en esta sesión, para no ofrecer dos veces la misma cita mientras se recarga la lista. */
  private readonly reviewedLocally = signal<ReadonlySet<number>>(new Set<number>());
  private readonly clientAppointments = signal<readonly AppointmentResponse[]>([]);
  protected readonly reviewFormOpen = signal(false);
  protected readonly reviewNotice = signal<string | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isClient = computed(() => this.auth.profileType() === 'CLIENT');

  protected readonly logoUrl = computed(() => this.resolveLogoUrl(this.business()?.logoUrl));
  protected readonly initial = computed(() => (this.business()?.name?.trim().charAt(0) || 'K').toUpperCase());
  protected readonly services = computed<readonly PublicServiceResponse[]>(
    () => this.business()?.services ?? [],
  );

  /** Citas completadas con este negocio que aún no tienen reseña. */
  protected readonly reviewableAppointments = computed<readonly ReviewableAppointment[]>(() => {
    const businessId = this.business()?.businessId;
    if (!this.isClient() || businessId == null) return [];
    const reviewed = new Set<number>([
      ...this.reviewedLocally(),
      ...this.reviews()
        .map((review) => review.appointmentId)
        .filter((id): id is number => id != null),
    ]);
    return this.clientAppointments()
      .filter((appointment) =>
        appointment.businessId === businessId &&
        appointment.status === 'COMPLETED' &&
        appointment.appointmentId != null &&
        !reviewed.has(appointment.appointmentId))
      .map((appointment) => ({
        id: appointment.appointmentId!,
        serviceName: appointment.serviceName ?? 'Servicio',
        startAt: appointment.startAt ?? '',
      }));
  });

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

  protected openReview(): void {
    this.reviewNotice.set(null);
    this.reviewFormOpen.set(true);
  }

  protected closeReview(): void {
    this.reviewFormOpen.set(false);
  }

  protected reviewCreated(appointmentId: number): void {
    this.reviewedLocally.update((ids) => new Set([...ids, appointmentId]));
    this.reviewNotice.set('¡Gracias! Tu reseña ya está publicada en el perfil del negocio.');
    void this.reloadReviews();
  }

  private async reloadReviews(): Promise<void> {
    try {
      const reviews = await firstValueFrom(this.api.getPublicReviews(this.slug()));
      this.reviews.set((reviews ?? []).filter((review) => review.visible !== false));
    } catch {
      // Si falla la recarga se conservan las reseñas ya visibles.
    }
  }

  /** Historial del cliente autenticado para saber qué citas puede reseñar. */
  private async loadClientAppointments(): Promise<void> {
    if (this.auth.profileType() !== 'CLIENT') return;
    try {
      const page = await firstValueFrom(this.appointmentsApi.getHistory({ page: 0, size: 100, sort: ['startAt,desc'] }));
      this.clientAppointments.set(page.content ?? []);
    } catch {
      this.clientAppointments.set([]);
    }
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
      void this.loadClientAppointments();
    } catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }
}

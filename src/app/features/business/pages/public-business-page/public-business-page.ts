import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicBusinessControllerService } from '../../../../core/api/openapi/api/publicBusinessController.service';
import type { PublicBusinessResponse } from '../../../../core/api/openapi/model/publicBusinessResponse';
import type { PublicEmployeeResponse } from '../../../../core/api/openapi/model/publicEmployeeResponse';
import type { PublicServiceResponse } from '../../../../core/api/openapi/model/publicServiceResponse';
import type { ReviewResponse } from '../../../../core/api/openapi/model/reviewResponse';
import { environment } from '../../../../../environments/environment';
import { PublicBookingWidget } from '../../ui/public-booking-widget/public-booking-widget';

type PublicTab = 'servicios' | 'equipo' | 'resenas';

interface HoursGroup {
  readonly label: string;
  readonly range: string | null;
}

/** Presenta la ficha pública del negocio, sus servicios, equipo, horarios y reseñas. */
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
  protected readonly activeTab = signal<PublicTab>('servicios');
  protected readonly weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  protected readonly tabs: readonly { key: PublicTab; label: string }[] = [
    { key: 'servicios', label: 'Servicios' },
    { key: 'equipo', label: 'Equipo' },
    { key: 'resenas', label: 'Reseñas' },
  ];

  protected readonly logoUrl = computed(() => this.resolveLogoUrl(this.business()?.logoUrl));
  protected readonly initial = computed(() => (this.business()?.name?.trim().charAt(0) || 'K').toUpperCase());
  protected readonly services = computed<readonly PublicServiceResponse[]>(
    () => this.business()?.services ?? [],
  );
  protected readonly employees = computed<readonly PublicEmployeeResponse[]>(
    () => (this.business()?.employees ?? []).filter((employee) => !!employee.name),
  );

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) { this.loading.set(false); this.error.set(true); return; }
    this.slug.set(slug);
    void this.load(slug);
  }

  /** Agrupa días consecutivos con el mismo horario para no repetir siete filas iguales. */
  protected readonly hoursGroups = computed<readonly HoursGroup[]>(() => {
    const days = this.weekdays.map((_, index) => this.hoursFor(index));
    const groups: HoursGroup[] = [];
    let start = 0;
    for (let index = 1; index <= days.length; index += 1) {
      if (index < days.length && days[index] === days[start]) continue;
      const label = start === index - 1
        ? this.weekdays[start]
        : `${this.weekdays[start]} a ${this.weekdays[index - 1]}`;
      groups.push({ label, range: days[start] });
      start = index;
    }
    return groups;
  });

  protected hoursFor(index: number): string | null {
    const hours = this.business()?.openingHours?.find((item) => item.dayOfWeek === index + 1);
    return hours?.startTime && hours.endTime ? `${hours.startTime.slice(0, 5)} – ${hours.endTime.slice(0, 5)}` : null;
  }

  protected employeeServices(employee: PublicEmployeeResponse): string {
    const ids = employee.serviceIds ?? [];
    if (!ids.length) return 'Servicios del negocio';
    const names = this.services()
      .filter((service) => service.serviceId != null && ids.includes(service.serviceId))
      .map((service) => service.name)
      .filter((name): name is string => !!name);
    return names.length ? names.join(', ') : 'Servicios del negocio';
  }

  protected initials(name?: string): string {
    return (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'K';
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

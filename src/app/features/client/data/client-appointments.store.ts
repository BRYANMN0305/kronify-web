import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PublicAppointmentControllerService } from '../../../core/api/openapi/api/publicAppointmentController.service';
import { PublicBusinessControllerService } from '../../../core/api/openapi/api/publicBusinessController.service';
import { ReviewControllerService } from '../../../core/api/openapi/api/reviewController.service';
import { BASE_PATH } from '../../../core/api/openapi/variables';
import type { AppointmentAutofillResponse } from '../../../core/api/openapi/model/appointmentAutofillResponse';
import type { AppointmentResponse } from '../../../core/api/openapi/model/appointmentResponse';
import type { DayAvailabilityResponse } from '../../../core/api/openapi/model/dayAvailabilityResponse';
import { AuthStore } from '../../../core/auth/auth.store';
import { SessionExpiredError } from '../../../core/api/jwt.interceptor';
import type { ClientAppointment, RecentBusiness } from '../models/client-appointment.model';

/**
 * Estado de las citas del cliente autenticado.
 * Reúne historial, cancelación, reseñas, negocios recientes y reprogramación.
 */
@Injectable({ providedIn: 'root' })
export class ClientAppointmentsStore {
  private readonly appointmentsApi = inject(PublicAppointmentControllerService);
  private readonly publicBusinessApi = inject(PublicBusinessControllerService);
  private readonly reviewApi = inject(ReviewControllerService);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly auth = inject(AuthStore);

  private readonly historyState = signal<readonly ClientAppointment[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly busyIdState = signal<number | null>(null);
  private readonly recentState = signal<readonly RecentBusiness[]>([]);
  private readonly recentLoadingState = signal(false);
  private readonly recentErrorState = signal<string | null>(null);
  private readonly recentUnavailableState = signal(true);
  private readonly reviewedIdsState = signal<ReadonlySet<number>>(new Set<number>());

  readonly history = this.historyState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly busyId = this.busyIdState.asReadonly();
  readonly recentBusinesses = this.recentState.asReadonly();
  readonly recentLoading = this.recentLoadingState.asReadonly();
  readonly recentError = this.recentErrorState.asReadonly();
  /** El backend desplegado puede no exponer /appointments/recent-businesses; se oculta sin romper la vista. */
  readonly recentUnavailable = this.recentUnavailableState.asReadonly();
  readonly reviewedIds = this.reviewedIdsState.asReadonly();

  readonly upcomingCount = computed(() => this.historyState().filter((item) =>
    item.status === 'PENDING' || item.status === 'CONFIRMED').length);

  private lastSessionUserId: string | null = null;

  constructor() {
    // Cambio de sesión → historial, reseñas y negocios recientes son de otra cuenta:
    // se descartan para que /mis-citas nunca muestre datos del usuario anterior.
    // Igual que BusinessStore, se observa el usuario y no el token para que refrescar
    // los claims del mismo usuario no borre el estado ya cargado.
    effect(() => {
      const userId = this.auth.user()?.sub ?? null;
      if (userId === this.lastSessionUserId) return;
      this.lastSessionUserId = userId;
      this.resetSessionData();
    });
  }

  /** Limpia el estado al cambiar de sesión (logout u otra cuenta). */
  private resetSessionData(): void {
    this.historyState.set([]);
    this.errorState.set(null);
    this.busyIdState.set(null);
    this.recentState.set([]);
    this.recentErrorState.set(null);
    this.recentUnavailableState.set(true);
    this.reviewedIdsState.set(new Set<number>());
  }

  /** Carga el historial; por defecto muestra primero las citas más recientes. */
  async loadHistory(size = 100, sort = 'startAt,desc'): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const page = await firstValueFrom(this.appointmentsApi.getHistory({ page: 0, size, sort: [sort] }));
      this.historyState.set((page.content ?? []).map((appointment) => this.fromApi(appointment)));
    } catch (error) {
      this.historyState.set([]);
      this.errorState.set(error instanceof SessionExpiredError
        ? 'Tu sesión expiró. Vuelve a iniciar sesión para ver tus citas.'
        : 'No se pudo cargar tu historial de citas. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.loadingState.set(false);
    }
  }

  /** Negocios donde el cliente ya reservó; tolera la ausencia del endpoint en el backend actual. */
  async loadRecentBusinesses(): Promise<void> {
    if (this.auth.profileType() !== 'CLIENT') return;
    this.recentLoadingState.set(true);
    this.recentErrorState.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(`${this.basePath}/appointments/recent-businesses`),
      );
      const items = Array.isArray(response) ? response : [];
      this.recentState.set(items
        .map((item) => this.normalizeRecentBusiness(item))
        .filter((item): item is RecentBusiness => item !== null));
      this.recentUnavailableState.set(false);
    } catch {
      // El backend desplegado no expone este endpoint (responde 500): la sección
      // se oculta en lugar de mostrar un error que el cliente no puede resolver.
      this.recentState.set([]);
      this.recentErrorState.set(null);
      this.recentUnavailableState.set(true);
    } finally {
      this.recentLoadingState.set(false);
    }
  }

  async cancel(appointmentId: number): Promise<boolean> {
    this.busyIdState.set(appointmentId);
    this.errorState.set(null);
    try {
      const updated = await firstValueFrom(this.appointmentsApi.cancelOwnAppointment(appointmentId));
      this.replaceOne(this.fromApi(updated));
      return true;
    } catch {
      this.errorState.set('No se pudo cancelar la cita. Intenta de nuevo.');
      return false;
    } finally {
      this.busyIdState.set(null);
    }
  }

  /**
   * Reprograma una cita propia con los endpoints disponibles para clientes:
   * crea la nueva cita y, si tuvo éxito, cancela la anterior. Si la cancelación
   * falla, revierte la nueva para no dejar dos reservas activas.
   */
  async reschedule(appointment: ClientAppointment, startAt: string): Promise<ClientAppointment> {
    if (appointment.businessId == null || appointment.serviceId == null || appointment.employeeId == null) {
      throw new Error('La cita no tiene los datos necesarios para reprogramarse.');
    }

    this.busyIdState.set(appointment.id);
    this.errorState.set(null);
    try {
      const created = await firstValueFrom(this.appointmentsApi.createAppointment1({
        businessId: appointment.businessId,
        serviceId: appointment.serviceId,
        employeeId: appointment.employeeId,
        startAt,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
      }));

      try {
        await firstValueFrom(this.appointmentsApi.cancelOwnAppointment(appointment.id));
      } catch (cancelError) {
        const createdId = created.appointmentId;
        if (createdId != null) {
          try {
            await firstValueFrom(this.appointmentsApi.cancelOwnAppointment(createdId));
          } catch {
            // La reversión es best-effort; el error original sigue siendo el relevante.
          }
        }
        throw cancelError;
      }

      const replacement = this.fromApi(created);
      this.historyState.update((items) =>
        items.map((item) => (item.id === appointment.id ? replacement : item)));
      return replacement;
    } finally {
      this.busyIdState.set(null);
    }
  }

  async submitReview(appointmentId: number, rating: number, comment: string): Promise<void> {
    this.busyIdState.set(appointmentId);
    this.errorState.set(null);
    try {
      await firstValueFrom(this.reviewApi.createReview({
        appointmentId,
        rating,
        comment: comment.trim() || undefined,
      }));
      this.reviewedIdsState.update((ids) => new Set([...ids, appointmentId]));
    } finally {
      this.busyIdState.set(null);
    }
  }

  availability(businessId: number, serviceId: number, date: string, employeeId?: number): Promise<DayAvailabilityResponse> {
    return firstValueFrom(this.publicBusinessApi.getAvailability(
      String(businessId), serviceId, date, employeeId,
    ));
  }

  autofill(): Promise<AppointmentAutofillResponse> {
    return firstValueFrom(this.appointmentsApi.getAutofill());
  }

  markReviewed(appointmentId: number): void {
    this.reviewedIdsState.update((ids) => new Set([...ids, appointmentId]));
  }

  private replaceOne(updated: ClientAppointment): void {
    this.historyState.update((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)));
  }

  private fromApi(response: AppointmentResponse): ClientAppointment {
    return {
      id: response.appointmentId ?? 0,
      businessId: response.businessId,
      serviceId: response.serviceId,
      employeeId: response.employeeId,
      serviceName: response.serviceName ?? 'Servicio',
      serviceDurationMinutes: response.serviceDurationMinutes ?? 0,
      employeeName: response.employeeName ?? 'Por asignar',
      startAt: response.startAt ?? '',
      endAt: response.endAt,
      status: response.status ?? 'PENDING',
      origin: response.origin,
      customerName: response.customerName,
      customerPhone: response.customerPhone,
      customerEmail: response.customerEmail,
    };
  }

  private normalizeRecentBusiness(value: unknown): RecentBusiness | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const businessId = Number(record['businessId']);
    const name = typeof record['name'] === 'string' ? record['name'] : '';
    const slug = typeof record['slug'] === 'string' ? record['slug'] : '';
    if (!Number.isFinite(businessId) || !name) return null;
    return {
      businessId,
      name,
      slug,
      logoUrl: typeof record['logoUrl'] === 'string' ? record['logoUrl'] : undefined,
      category: typeof record['category'] === 'string' ? record['category'] : undefined,
      address: typeof record['address'] === 'string' ? record['address'] : undefined,
      lastAppointmentAt: typeof record['lastAppointmentAt'] === 'string' ? record['lastAppointmentAt'] : undefined,
    };
  }
}

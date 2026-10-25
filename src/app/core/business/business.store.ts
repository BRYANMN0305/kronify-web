import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { BusinessControllerService } from '../api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../api/openapi/api/employeeController.service';
import { EmployeeInvitationControllerService } from '../api/openapi/api/employeeInvitationController.service';
import { BusinessCreateRequest } from '../api/openapi/model/businessCreateRequest';
import { BusinessCreateResponse } from '../api/openapi/model/businessCreateResponse';
import { EmployeeResponse } from '../api/openapi/model/employeeResponse';
import { InvitationResponse } from '../api/openapi/model/invitationResponse';
import { Business } from '../types/business';

/**
 * BusinessStore — Equivalente de stores/business.js (kernel de A).
 * El estado se limpia solo cuando cambia el token de sesión (effect sobre AuthStore.token),
 * Cada store observa la sesión y descarta datos que pertenezcan a la cuenta anterior.
 */
@Injectable({ providedIn: 'root' })
export class BusinessStore {
  private readonly businessApi = inject(BusinessControllerService);
  private readonly employeeApi = inject(EmployeeControllerService);
  private readonly invitationApi = inject(EmployeeInvitationControllerService);
  private readonly authStore = inject(AuthStore);

  readonly business = signal<Business | null>(null);
  readonly employees = signal<EmployeeResponse[]>([]);
  readonly pendingInvitations = signal<InvitationResponse[]>([]);
  readonly fetched = signal(false);
  readonly loading = signal(false);

  readonly hasBusiness = computed(() => !!this.business());
  readonly hasEmployee = computed(() => this.employees().length > 0);
  readonly hasPendingInvitation = computed(() => this.pendingInvitations().length > 0);
  readonly needsOnboarding = computed(
    () => this.fetched() && !this.hasBusiness() && !this.hasEmployee() && !this.hasPendingInvitation(),
  );

  constructor() {
    // Cambio de sesión (login con otra cuenta, logout) → estado en blanco, sin datos de la cuenta anterior
    effect(() => {
      this.authStore.token();
      this.reset();
    });
  }

  /** fetchStatus — negocio del usuario (null si 404) + registro de empleado activo */
  async fetchStatus(): Promise<void> {
    this.loading.set(true);
    try {
      const [business] = await Promise.all([this.getMe(), this.loadMyEmployee()]);
      this.business.set(business);
      this.fetched.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async getMe(): Promise<Business | null> {
    try {
      return await firstValueFrom(this.businessApi.getMyBusinessSettings());
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  /** loadMyEmployee — empleado activo (ej. aceptó invitación) evita onboarding; otros 404 se ignoran */
  private async loadMyEmployee(): Promise<void> {
    try {
      const me = await firstValueFrom(this.employeeApi.getMyEmployee());
      this.employees.set([me]);
    } catch {
      /* sin registro de empleado para este usuario */
    }
  }

  async createBusiness(payload: BusinessCreateRequest): Promise<BusinessCreateResponse> {
    const created = await firstValueFrom(this.businessApi.createBusiness(payload));
    this.business.set(created);
    this.fetched.set(true);
    return created;
  }

  /** loadPendingInvitations — invitaciones del negocio (las lista el employeeInvitationController) */
  async loadPendingInvitations(): Promise<void> {
    const data = await firstValueFrom(this.invitationApi.listInvitations());
    this.pendingInvitations.set(data ?? []);
  }

  /** reset — limpia el estado por cambio de sesión */
  reset(): void {
    this.business.set(null);
    this.employees.set([]);
    this.pendingInvitations.set([]);
    this.fetched.set(false);
    this.loading.set(false);
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { BusinessControllerService } from '../api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../api/openapi/api/employeeController.service';
import { PlanControllerService } from '../api/openapi/api/planController.service';
import { UserControllerService } from '../api/openapi/api/userController.service';
import { BusinessPlanUsageResponse } from '../api/openapi/model/businessPlanUsageResponse';
import { BusinessSettingsResponse } from '../api/openapi/model/businessSettingsResponse';
import { LinkedAuthMethodResponse } from '../api/openapi/model/linkedAuthMethodResponse';
import { UserProfileResponse } from '../api/openapi/model/userProfileResponse';
import { UserUpdateRequest } from '../api/openapi/model/userUpdateRequest';

/**
 * SettingsStore — Equivalente de stores/settings.js (kernel de A).
 * Centraliza datos de la cuenta (perfil, métodos de auth), del negocio
 * (dueño), y del plan con su uso — con caché por sección: la primera
 * carga usa spinner y las siguientes revalidan en silencio.
 * Subport del shell: la página de configuración extenderá con
 * invitaciones / historial / catálogo de planes (TODO(A)).
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly userApi = inject(UserControllerService);
  private readonly businessApi = inject(BusinessControllerService);
  private readonly planApi = inject(PlanControllerService);
  private readonly employeeApi = inject(EmployeeControllerService);
  private readonly authStore = inject(AuthStore);

  readonly profile = signal<UserProfileResponse | null>(null);
  readonly authMethods = signal<LinkedAuthMethodResponse[]>([]);
  readonly businessData = signal<BusinessSettingsResponse | null>(null);
  readonly plan = signal<BusinessPlanUsageResponse | null>(null);
  readonly ownerAsEmployee = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  /** Marca qué secciones ya fueron cargadas al menos una vez */
  readonly profileLoaded = signal(false);
  readonly businessLoaded = signal(false);
  readonly planLoaded = signal(false);
  readonly ownerAsEmployeeLoaded = signal(false);

  private lastToken: string | null = this.authStore.token();

  constructor() {
    // Cambio de sesión → descarta la caché anterior (datos de otra cuenta).
    effect(() => {
      const token = this.authStore.token();
      if (token !== this.lastToken) {
        this.lastToken = token;
        this.reset();
      }
    });
  }

  /** fetchProfile — Perfil + métodos de autenticación ligados */
  async fetchProfile(): Promise<void> {
    const [profile, authMethods] = await Promise.all([
      firstValueFrom(this.userApi.getProfile()),
      firstValueFrom(this.userApi.linkedAuthMethods()).catch(() => []),
    ]);
    this.profile.set(profile);
    this.authMethods.set(authMethods ?? []);
    this.profileLoaded.set(true);
  }

  /** updateProfile — Guarda datos personales y fusiona la respuesta en el perfil */
  async updateProfile(payload: UserUpdateRequest): Promise<void> {
    const updated = await firstValueFrom(this.userApi.updateUser(payload));
    this.profile.update((profile) => (profile ? { ...profile, ...updated } : profile));
  }

  /** fetchBusiness — Negocio del dueño (404 → null igual que BusinessStore) */
  async fetchBusiness(): Promise<void> {
    try {
      this.businessData.set(await firstValueFrom(this.businessApi.getMyBusinessSettings()));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.businessData.set(null);
      } else {
        throw error;
      }
    }
    this.businessLoaded.set(true);
  }

  /** fetchPlan — Plan vigente con métricas de uso */
  async fetchPlan(): Promise<void> {
    this.plan.set(await firstValueFrom(this.planApi.getCurrentPlan()));
    this.planLoaded.set(true);
  }

  /** fetchOwnerAsEmployee — ¿El dueño tiene registro de employee activo? */
  async fetchOwnerAsEmployee(): Promise<void> {
    try {
      const records = await firstValueFrom(this.employeeApi.listEmployees());
      this.ownerAsEmployee.set(records.some((record) => record.owner === true));
    } catch {
      this.ownerAsEmployee.set(false);
    }
    this.ownerAsEmployeeLoaded.set(true);
  }

  /** fetchAll — Primera carga en paralelo; visitas siguientes revalidan en silencio */
  async fetchAll(isOwner: boolean, options?: { silent?: boolean }): Promise<void> {
    const hasData = this.profileLoaded();
    const silentMode = options?.silent ?? hasData;
    if (!silentMode) this.loading.set(true);
    this.error.set('');

    try {
      const tasks: Promise<void>[] = [this.fetchProfile()];
      if (isOwner) {
        tasks.push(this.fetchBusiness(), this.fetchPlan(), this.fetchOwnerAsEmployee());
      }
      await Promise.all(tasks);
    } catch (error) {
      if (!silentMode) {
        this.error.set(apiErrorMessage(error) || 'Error al cargar la configuración');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** reset — Limpia el estado completo al cambiar de sesión */
  reset(): void {
    this.profile.set(null);
    this.authMethods.set([]);
    this.businessData.set(null);
    this.plan.set(null);
    this.ownerAsEmployee.set(false);
    this.loading.set(false);
    this.error.set('');
    this.profileLoaded.set(false);
    this.businessLoaded.set(false);
    this.planLoaded.set(false);
    this.ownerAsEmployeeLoaded.set(false);
  }
}

function apiErrorMessage(error: unknown): string {
  return error instanceof HttpErrorResponse ? error.statusText : error instanceof Error ? error.message : '';
}

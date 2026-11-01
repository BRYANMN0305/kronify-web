import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { BusinessControllerService } from '../api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../api/openapi/api/employeeController.service';
import { EmployeeInvitationControllerService } from '../api/openapi/api/employeeInvitationController.service';
import { PlanControllerService } from '../api/openapi/api/planController.service';
import { PublicPlanControllerService } from '../api/openapi/api/publicPlanController.service';
import { UploadControllerService } from '../api/openapi/api/uploadController.service';
import { UserControllerService } from '../api/openapi/api/userController.service';
import { BusinessPlanResponse } from '../api/openapi/model/businessPlanResponse';
import { BusinessPlanUsageResponse } from '../api/openapi/model/businessPlanUsageResponse';
import { BusinessSettingsResponse } from '../api/openapi/model/businessSettingsResponse';
import { BusinessUpdateRequest } from '../api/openapi/model/businessUpdateRequest';
import { BusinessUpdateResponse } from '../api/openapi/model/businessUpdateResponse';
import { InvitationResponse } from '../api/openapi/model/invitationResponse';
import { LinkedAuthMethodResponse } from '../api/openapi/model/linkedAuthMethodResponse';
import { PlanResponse } from '../api/openapi/model/planResponse';
import { UploadFileRequest } from '../api/openapi/model/uploadFileRequest';
import { UserChangePasswordRequest } from '../api/openapi/model/userChangePasswordRequest';
import { UserChangePasswordResponse } from '../api/openapi/model/userChangePasswordResponse';
import { UserProfileResponse } from '../api/openapi/model/userProfileResponse';
import { UserUpdateRequest } from '../api/openapi/model/userUpdateRequest';

/**
 * SettingsStore — Equivalente de stores/settings.js (kernel de A).
 * Centraliza datos de la cuenta (perfil, métodos de auth), del negocio
 * (dueño), invitaciones y plan con su uso — con caché por sección: la
 * primera carga usa spinner y las siguientes revalidan en silencio.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly userApi = inject(UserControllerService);
  private readonly businessApi = inject(BusinessControllerService);
  private readonly planApi = inject(PlanControllerService);
  private readonly publicPlanApi = inject(PublicPlanControllerService);
  private readonly employeeApi = inject(EmployeeControllerService);
  private readonly invitationApi = inject(EmployeeInvitationControllerService);
  private readonly uploadApi = inject(UploadControllerService);
  private readonly authStore = inject(AuthStore);

  readonly profile = signal<UserProfileResponse | null>(null);
  readonly authMethods = signal<LinkedAuthMethodResponse[]>([]);
  readonly businessData = signal<BusinessSettingsResponse | null>(null);
  readonly invitations = signal<InvitationResponse[]>([]);
  readonly plan = signal<BusinessPlanUsageResponse | null>(null);
  readonly planHistory = signal<BusinessPlanResponse[]>([]);
  readonly availablePlans = signal<PlanResponse[]>([]);
  readonly ownerAsEmployee = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  /** Marca qué secciones ya fueron cargadas al menos una vez */
  readonly profileLoaded = signal(false);
  readonly businessLoaded = signal(false);
  readonly invitationsLoaded = signal(false);
  readonly planLoaded = signal(false);
  readonly planHistoryLoaded = signal(false);
  readonly availablePlansLoaded = signal(false);
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

  /** updatePassword — Cambia la contraseña del usuario autenticado */
  async updatePassword(payload: UserChangePasswordRequest): Promise<UserChangePasswordResponse> {
    return firstValueFrom(this.userApi.updatePassword(payload));
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

  /** updateBusiness — Guarda los datos del negocio y fusiona la respuesta local */
  async updateBusiness(payload: BusinessUpdateRequest): Promise<BusinessUpdateResponse> {
    const updated = await firstValueFrom(this.businessApi.updateBusiness(payload));
    this.businessData.update((business) =>
      business
        ? { ...business, ...payload, updatedAt: updated.updatedAt ?? business.updatedAt }
        : business,
    );
    return updated;
  }

  /** uploadLogo — Sube el logo y devuelve su URL pública */
  async uploadLogo(file: File): Promise<string | null> {
    const response = await firstValueFrom(
      this.uploadApi.uploadFile({ file } satisfies UploadFileRequest),
    );
    return response['url'] ?? null;
  }

  /** toggleOwnerAsEmployee — Activa/desactiva al dueño como empleado de su negocio */
  async toggleOwnerAsEmployee(enabled: boolean): Promise<void> {
    await firstValueFrom(this.employeeApi.toggleOwnerEmployee({ enabled }));
    this.ownerAsEmployee.set(enabled);
    await Promise.allSettled([this.fetchPlan(), this.fetchOwnerAsEmployee()]);
  }

  /** fetchInvitations — Invitaciones del negocio (solo dueño) */  async fetchInvitations(): Promise<void> {
    this.invitations.set(await firstValueFrom(this.invitationApi.listInvitations()));
    this.invitationsLoaded.set(true);
  }

  /** createInvitation — Envía una invitación y refresca la lista */
  async createInvitation(email: string): Promise<InvitationResponse> {
    const created = await firstValueFrom(this.invitationApi.createInvitation({ email }));
    await this.fetchInvitations();
    return created;
  }

  /** resendInvitation — Reenvía una invitación pendiente y refresca la lista */
  async resendInvitation(invitationId: number): Promise<void> {
    await firstValueFrom(this.invitationApi.resendInvitation(invitationId));
    await this.fetchInvitations();
  }

  /** cancelInvitation — Cancela una invitación pendiente y refresca la lista */
  async cancelInvitation(invitationId: number): Promise<void> {
    await firstValueFrom(this.invitationApi.cancelInvitation(invitationId));
    await this.fetchInvitations();
  }

  /** fetchPlan — Plan vigente con métricas de uso */
  async fetchPlan(): Promise<void> {
    this.plan.set(await firstValueFrom(this.planApi.getCurrentPlan()));
    this.planLoaded.set(true);
  }

  /** fetchPlanHistory — Historial de planes del negocio */
  async fetchPlanHistory(): Promise<void> {
    this.planHistory.set(await firstValueFrom(this.planApi.getPlanHistory()));
    this.planHistoryLoaded.set(true);
  }

  /** fetchAvailablePlans — Catálogo público de planes disponibles */
  async fetchAvailablePlans(): Promise<void> {
    this.availablePlans.set(await firstValueFrom(this.publicPlanApi.getPublicPlans()));
    this.availablePlansLoaded.set(true);
  }

  /** changePlan — Asigna un plan y refresca plan + historial */
  async changePlan(planId: number, activationCode?: string): Promise<void> {
    await firstValueFrom(this.planApi.assignPlan({ planId, activationCode }));
    await Promise.all([this.fetchPlan(), this.fetchPlanHistory()]);
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
        tasks.push(
          this.fetchBusiness(),
          this.fetchInvitations(),
          this.fetchPlan(),
          this.fetchPlanHistory(),
          this.fetchAvailablePlans(),
          this.fetchOwnerAsEmployee(),
        );
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
    this.invitations.set([]);
    this.plan.set(null);
    this.planHistory.set([]);
    this.availablePlans.set([]);
    this.ownerAsEmployee.set(false);
    this.loading.set(false);
    this.error.set('');
    this.profileLoaded.set(false);
    this.businessLoaded.set(false);
    this.invitationsLoaded.set(false);
    this.planLoaded.set(false);
    this.planHistoryLoaded.set(false);
    this.availablePlansLoaded.set(false);
    this.ownerAsEmployeeLoaded.set(false);
  }
}

function apiErrorMessage(error: unknown): string {
  return error instanceof HttpErrorResponse ? error.statusText : error instanceof Error ? error.message : '';
}

import { Injectable, computed, inject } from '@angular/core';

import { AuthStore } from './auth.store';
import { BusinessStore } from '../business/business.store';

/**
 * Permissions — Equivalente de usePermissions.js: qué secciones ve cada rol.
 *   Dueño:    calendario, servicios, horarios, configuración
 *   Empleado: calendario, horarios (self-service), configuración
 *   Cliente:  calendario, configuración
 */
@Injectable({ providedIn: 'root' })
export class Permissions {
  private readonly auth = inject(AuthStore);
  private readonly business = inject(BusinessStore);

  /** isOwner — Dueño del negocio (BUSINESS con negocio creado) */
  readonly isOwner = computed(() => this.auth.isBusiness() && this.business.hasBusiness());

  /** isEmployee — Empleado activo de un negocio (BUSINESS sin negocio propio) */
  readonly isEmployee = computed(
    () => this.auth.isBusiness() && !this.business.hasBusiness() && this.business.hasEmployee(),
  );

  /** canManageServices — CRUD de servicios: solo el dueño */
  readonly canManageServices = computed(() => this.auth.isBusiness() && this.business.hasBusiness());

  /** canManageSchedules — Horarios: dueño y empleados (autogestión) */
  readonly canManageSchedules = computed(() => this.auth.isBusiness());
}

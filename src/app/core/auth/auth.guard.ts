import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from './auth.store';
import { BusinessStore } from '../business/business.store';

/**
 * authGuard — Equivalente del authGuard global de vue-router (guards.js).
 * Se declara en TODAS las rutas que quiera proteger; cada ruta declara su meta en `data`:
 *   data: { guest: true }               → si hay sesión, manda a /calendario
 *   data: { requiresAuth: true }        → sin sesión, manda a /iniciar-sesion
 *   data: { onboardingRoute: true }     → marca la ruta /onboarding-negocio (ciclo BUSINESS)
 */
export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthStore);
  const business = inject(BusinessStore);
  const router = inject(Router);
  const data = route.data as { guest?: boolean; requiresAuth?: boolean; onboardingRoute?: boolean };

  // Rutas de invitados con sesión activa → Calendario
  if (data['guest'] && auth.isAuthenticated()) {
    return router.parseUrl('/calendario');
  }

  // Rutas protegidas sin sesión → Iniciar sesión
  if (data['requiresAuth'] && !auth.isAuthenticated()) {
    return router.parseUrl('/iniciar-sesion');
  }

  // Ciclo de onboarding para usuarios BUSINESS
  if (auth.isAuthenticated() && auth.isBusiness()) {
    if (!business.fetched()) {
      try {
        await business.fetchStatus();
      } catch {
        return true;
      }
    }
    if (business.needsOnboarding() && !data['onboardingRoute']) {
      return router.parseUrl('/onboarding-negocio');
    }
    if (data['onboardingRoute'] && !business.needsOnboarding()) {
      return router.parseUrl('/calendario');
    }
  }

  return true;
};

import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppLayout } from './layout/app-layout/app-layout';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { SETTINGS_ROUTES } from './features/settings/settings.routes';

/**
 * Shell de rutas — owned por 🅰 Persona A. Reglas del equipo:
 * Cada persona SOLO agrega/sustituye sus `loadChildren`/`loadComponent` en su sección
 * (comentario TODO en el archivo = marca del owner pendiente).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'iniciar-sesion' },

  // ── 🅰 PERSONA A: públicas / shell / cuenta ─────────────────────────────
  ...AUTH_ROUTES,

  // TODO(A): { path: 'invitacion/aceptar', loadChildren: ... } — feature invitation

  // Onboarding fullscreen (feature onboarding)
  { path: 'onboarding-negocio',
    data: { requiresAuth: true, onboardingRoute: true, title: 'Onboarding del negocio' },
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/pages/onboarding-business-page/onboarding-business-page').then(m => m.OnboardingBusinessPage) },

  // Vista previa académica de la agenda, disponible sin autenticación.
  { path: 'demo-calendario',
    component: AppLayout,
    data: { title: 'Vista previa de agenda' },
    children: [{ path: '',
      data: { demoMode: true, title: 'Vista previa de agenda' },
      loadComponent: () => import('./features/agenda/pages/agenda-page/agenda-page').then(m => m.AgendaPage) }] },

  // ── 🅱 PERSONA B: operación de citas (children del layout autenticado) ──
  { path: '',
    component: AppLayout,
    canActivate: [authGuard],
    data: { requiresAuth: true },
    children: [
      { path: 'calendario',
        data: { title: 'Calendario' },
        loadComponent: () => import('./features/agenda/pages/agenda-page/agenda-page').then(m => m.AgendaPage) },

      ...SETTINGS_ROUTES,

      // TODO(B): 'mis-citas' · 'resenas' · 'servicios' · 'horarios'
      // TODO(B): { path: 'negocio/:slug', ... } pública, fuera de este layout
    ] },

  { path: '**', redirectTo: '/calendario' },
];

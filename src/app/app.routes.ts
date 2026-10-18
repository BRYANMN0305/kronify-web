import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppLayout } from './layout/app-layout/app-layout';
import { AUTH_ROUTES } from './features/auth/auth.routes';

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

  // TODO(A): { path: 'configuracion', loadChildren: ... } — feature settings

  // ── 🅱 PERSONA B: operación de citas (children del layout autenticado) ──
  { path: '',
    component: AppLayout,
    canActivate: [authGuard],
    data: { requiresAuth: true },
    children: [
      { path: 'calendario',
        data: { title: 'Calendario — ventana provisional de la migración' },
        loadComponent: () => import('./layout/app-layout/pending-page/pending-page').then(m => m.PendingPage) },

      // TODO(B): 'mis-citas' · 'resenas' · 'servicios' · 'horarios'
      // TODO(B): { path: 'negocio/:slug', ... } pública, fuera de este layout
    ] },

  { path: '**', redirectTo: '/calendario' },
];

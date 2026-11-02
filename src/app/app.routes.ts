import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppLayout } from './layout/app-layout/app-layout';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { INVITATION_ROUTES } from './features/invitation/invitation.routes';
import { SETTINGS_ROUTES } from './features/settings/settings.routes';

/**
 * Shell de rutas. Cada feature registra aquí su carga diferida o componente de entrada.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'iniciar-sesion' },

  // ── Públicas, shell y cuenta ────────────────────────────────────────────
  ...AUTH_ROUTES,
  ...INVITATION_ROUTES,

  // Perfil público del negocio, fuera del shell de administración.
  { path: 'negocio/:slug', data: { title: 'Negocio' }, loadComponent: () => import('./features/business/pages/public-business-page/public-business-page').then(m => m.PublicBusinessPage) },

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

  // ── Operación de citas (children del layout autenticado) ─────────────────
  { path: '',
    component: AppLayout,
    canActivate: [authGuard],
    data: { requiresAuth: true },
    children: [
      { path: 'calendario',
        data: { title: 'Calendario' },
        loadComponent: () => import('./features/agenda/pages/agenda-page/agenda-page').then(m => m.AgendaPage) },

      { path: 'servicios', data: { title: 'Servicios' }, loadComponent: () => import('./features/business/pages/services-page/services-page').then(m => m.ServicesPage) },
      { path: 'horarios', data: { title: 'Horarios' }, loadComponent: () => import('./features/business/pages/schedules-page/schedules-page').then(m => m.SchedulesPage) },

      ...SETTINGS_ROUTES,

      { path: 'resenas', data: { title: 'Reseñas' }, loadComponent: () => import('./features/business/pages/reviews-page/reviews-page').then(m => m.ReviewsPage) },
      // TODO(B): 'mis-citas'
    ] },

  { path: '**', redirectTo: '/calendario' },
];

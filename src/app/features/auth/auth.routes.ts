import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

/**
 * Rutas de autenticación.
 /iniciar-sesion y /registro comparten el MISMO componente (AuthPage) para que
 la transición de la pantalla se conserva sin recargar la feature.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'iniciar-sesion',
    loadComponent: () => import('./pages/auth-page/auth-page').then(m => m.AuthPage),
    canActivate: [authGuard],
    data: { guest: true, mode: 'login' },
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/auth-page/auth-page').then(m => m.AuthPage),
    canActivate: [authGuard],
    data: { guest: true, mode: 'register' },
  },
  {
    path: 'oauth/callback',
    loadComponent: () => import('./pages/oauth-callback-page/oauth-callback-page').then(m => m.OAuthCallbackPage),
  },
];

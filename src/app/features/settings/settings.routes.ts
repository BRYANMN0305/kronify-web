import { Routes } from '@angular/router';

/** Rutas de configuración que se insertan dentro del layout autenticado principal. */
export const SETTINGS_ROUTES: Routes = [
  {
    path: 'configuracion',
    data: { title: 'Configuración' },
    loadComponent: () =>
      import('./pages/settings-page/settings-page').then((m) => m.SettingsPage),
  },
];

import { Routes } from '@angular/router';

export const INVITATION_ROUTES: Routes = [
  {
    path: 'invitacion/aceptar',
    data: { title: 'Aceptar invitación' },
    loadComponent: () =>
      import('./pages/invitation-accept-page/invitation-accept-page').then(
        (m) => m.InvitationAcceptPage,
      ),
  },
];

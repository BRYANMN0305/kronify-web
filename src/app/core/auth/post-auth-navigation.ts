import { Router } from '@angular/router';

import { consumePendingInvitation, AuthStore } from './auth.store';
import { BusinessStore } from '../business/business.store';

/**
 * Port de la navegación final de useAuth.js (aplicable tras login, registro y OAuth callback):
 *   1. invitación pendiente → /invitacion/aceptar?token=...
 *   2. BUSINESS → fetchStatus y, si corresponde, /onboarding-negocio
 *   3. destino por defecto → /calendario
 */
export async function navigateAfterAuth(router: Router, auth: AuthStore, business: BusinessStore): Promise<void> {
  const inviteToken = consumePendingInvitation();
  if (inviteToken) {
    await router.navigate(['/invitacion/aceptar'], { queryParams: { token: inviteToken } });
    return;
  }

  if (auth.isBusiness()) {
    try {
      await business.fetchStatus();
    } catch {
      /* el authGuard hará el mismo check al navegar */
    }
    if (business.needsOnboarding()) {
      await router.navigate(['/onboarding-negocio']);
      return;
    }
  }

  await router.navigate(['/calendario']);
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';

/**
 * clientGuard — Las vistas de "Mis citas" y el calendario personal son exclusivas
 * del perfil CLIENT. Un negocio o empleado vuelve a su agenda operativa.
 */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return auth.profileType() === 'CLIENT' ? true : router.parseUrl('/calendario');
};

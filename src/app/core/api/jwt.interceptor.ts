import { HttpErrorResponse, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenStorage } from '../auth/token.storage';

/** Flag de contexto HTTP: peticiones sin token (login/oauth/registro) */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export class SessionExpiredError extends Error {
  readonly status = 401;
  constructor() {
    super('Tu sesión expiró. Inicia sesión nuevamente.');
    this.name = 'SessionExpiredError';
  }
}

/** Equivalente del http.js de Vue: adjunta JWT y expulsa la sesión en 401 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const token = storage.getToken();

  const authed =
    token && !req.context.get(SKIP_AUTH)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        storage.clear();
        if (!router.url.startsWith('/iniciar-sesion')) {
          router.navigate(['/iniciar-sesion']);
        }
        return throwError(() => new SessionExpiredError());
      }
      return throwError(() => error);
    }),
  );
};

import { HttpErrorResponse, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenStorage } from '../auth/token.storage';
import { environment } from '../../../environments/environment';

/** Flag de contexto HTTP: peticiones sin token (login/oauth/registro) */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export class SessionExpiredError extends Error {
  readonly status = 401;
  constructor() {
    super('Tu sesión expiró. Inicia sesión nuevamente.');
    this.name = 'SessionExpiredError';
  }
}

/** Evita que el bearer token se envíe a servicios de terceros por accidente. */
function isApiRequest(url: string): boolean {
  try {
    const apiUrl = new URL(environment.apiUrl);
    const requestUrl = new URL(url, apiUrl);
    const basePath = apiUrl.pathname.replace(/\/$/, '');
    const matchesBasePath =
      !basePath || requestUrl.pathname === basePath || requestUrl.pathname.startsWith(`${basePath}/`);

    return requestUrl.origin === apiUrl.origin && matchesBasePath;
  } catch {
    return false;
  }
}

/** Adjunta el JWT al API propio y cierra una sesión que el servidor rechaza con 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const token = storage.getToken();

  const authed =
    token && !req.context.get(SKIP_AUTH) && isApiRequest(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && isApiRequest(req.url)) {
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

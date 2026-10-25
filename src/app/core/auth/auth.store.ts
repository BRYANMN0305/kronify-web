import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthControllerService } from '../api/openapi/api/authController.service';
import {
  LoginRequest,
  OAuthProfileRequest,
  TokenResponse,
  UserRegisterRequest,
} from '../api/openapi/model/models';
import { BASE_PATH } from '../api/openapi/variables';
import { TokenStorage } from './token.storage';

/** Claims del JWT emitido por el backend y consumidos por la interfaz. */
export interface JwtClaims {
  sub?: string;
  email?: string;
  name?: string;
  lastName?: string;
  profileType?: 'BUSINESS' | 'CLIENT';
  exp?: number;
  /** slug público del negocio (claim del JWT cuando ya existe el negocio) */
  slug?: string;
  [key: string]: unknown;
}

/** Mapa de proveedores del frontend a los registrationId del backend */
type OAuthProvider = 'google' | 'microsoft';
const OAUTH_REGISTRATION_IDS: Record<OAuthProvider, string> = {
  google: 'google',
  microsoft: 'azure',
};

/** decodeJwt — Extrae el payload de un JWT sin verificar firma (solo lectura) */
function decodeJwt(token: string | null): JwtClaims | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** Solo acepta JWTs bien formados y aún vigentes; el backend sigue siendo la autoridad. */
function isUsableJwt(token: string | null): token is string {
  const claims = decodeJwt(token);
  if (!claims || !token) return false;
  return typeof claims.exp !== 'number' || claims.exp * 1000 > Date.now();
}

/** consumePendingInvitation — Devuelve y limpia el token de invitación de sessionStorage */
export function consumePendingInvitation(): string | null {
  const token = sessionStorage.getItem('inviteToken');
  if (!token) return null;
  sessionStorage.removeItem('inviteToken');
  return token;
}

/** extrae el mensaje de error humano de una HttpErrorResponse del backend */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string } | null;
    return body?.message ?? error.statusText ?? `HTTP ${error.status}`;
  }
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * AuthStore — Estado y operaciones de sesión (equivalente de stores/auth.js + useAuth.js).
 * La NAVEGACIÓN luego de autenticar no vive aquí: la resuelven las pages/guards con Router.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthControllerService);
  private readonly storage = inject(TokenStorage);
  private readonly basePath = inject(BASE_PATH);
  private readonly restoredToken = this.restoreToken();

  private readonly tokenSignal = signal<string | null>(this.restoredToken);
  private readonly userSignal = signal<JwtClaims | null>(decodeJwt(this.restoredToken));
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly oauthRedirectingSignal = signal(false);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly oauthRedirecting = this.oauthRedirectingSignal.asReadonly();

  readonly token = this.tokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => isUsableJwt(this.tokenSignal()));
  readonly profileType = computed(() => this.user()?.profileType ?? null);
  readonly isBusiness = computed(() => this.profileType() === 'BUSINESS');

  /** setAuth — Guarda el token y deriva el usuario de sus claims */
  private setAuth(accessToken: string): void {
    const token = accessToken?.trim();
    if (!token) {
      throw new Error('La respuesta de autenticación no incluyó un token válido.');
    }
    if (!isUsableJwt(token)) {
      throw new Error('La respuesta de autenticación incluyó un token inválido o expirado.');
    }
    this.tokenSignal.set(token);
    this.userSignal.set(decodeJwt(token));
    this.storage.setToken(token);
    this.storage.setUser(this.userSignal());
  }

  private restoreToken(): string | null {
    const token = this.storage.getToken();
    if (isUsableJwt(token)) return token;
    if (token) this.storage.clear();
    return null;
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.loadingSignal.set(false);
    this.errorSignal.set(null);
    this.oauthRedirectingSignal.set(false);
    this.storage.clear();
  }

  /** login — Credenciales email/contraseña → sesión activa */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const token = await firstValueFrom(this.authApi.login(credentials));
      this.setAuth(token.accessToken ?? '');
      return token;
    } catch (error) {
      this.errorSignal.set(apiErrorMessage(error));
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** register — Registro con UserRegisterRequest (equ enums: CLIENT | BUSINESS) */
  async register(payload: UserRegisterRequest): Promise<TokenResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const token = await firstValueFrom(this.authApi.register(payload));
      this.setAuth(token.accessToken ?? '');
      return token;
    } catch (error) {
      this.errorSignal.set(apiErrorMessage(error));
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** oauthLoginUrl — URL completa de redirección al proveedor; la page hace window.location.href */
  oauthLoginUrl(provider: OAuthProvider): string {
    const registrationId = OAUTH_REGISTRATION_IDS[provider] ?? provider;
    this.oauthRedirectingSignal.set(true);
    return `${this.basePath}/oauth2/authorization/${registrationId}`;
  }

  /** finalizeOAuthLogin — Aplica el JWT recibido en /oauth/callback */
  finalizeOAuthLogin(accessToken: string): void {
    this.setAuth(accessToken);
  }

  /** completeOAuthProfile — primer login OAuth: guarda el tipo de perfil y renueva el JWT */
  async completeOAuthProfile(profileType: OAuthProfileRequest['profileType']): Promise<void> {
    const token = await firstValueFrom(this.authApi.selectOAuthProfile({ profileType } as OAuthProfileRequest));
    this.setAuth(token.accessToken ?? '');
  }
}

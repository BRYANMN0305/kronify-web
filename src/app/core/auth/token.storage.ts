import { Injectable } from '@angular/core';

/** Sesión guardada en localStorage con las mismas claves del proyecto Vue ('token', 'user'). */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY = 'user';

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getUser(): unknown {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  }

  setUser(user: unknown): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}

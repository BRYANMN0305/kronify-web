import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../../../core/auth/auth.store';
import { BusinessStore } from '../../../../core/business/business.store';
import { navigateAfterAuth } from '../../../../core/auth/post-auth-navigation';
import { AuthLayout } from '../../../../layout/auth-layout/auth-layout';
import { LoginForm } from '../../ui/login-form/login-form';
import { RegisterForm } from '../../ui/register-form/register-form';
import { OAuthProvider } from '../../ui/oauth-buttons/oauth-buttons';
import { LoginRequest } from '../../../../core/api/openapi/model/loginRequest';
import { UserRegisterRequest } from '../../../../core/api/openapi/model/userRegisterRequest';

type AuthMode = 'login' | 'register';

export type { AuthMode };

/** Vista única de autenticación con slide animado (port de AuthView.vue); la ruta decide el modo. */
@Component({
  selector: 'app-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, LoginForm, RegisterForm],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly business = inject(BusinessStore);

  /** Se enlaza desde route data vía withComponentInputBinding */
  readonly mode = input.required<AuthMode>();

  readonly slide = signal<'left' | 'right'>('left');

  switchToRegister(): void {
    this.slide.set('left');
    this.router.navigate(['/registro']);
  }

  switchToLogin(): void {
    this.slide.set('right');
    this.router.navigate(['/iniciar-sesion']);
  }

  async onLogin(credentials: LoginRequest): Promise<void> {
    try {
      await this.auth.login(credentials);
    } catch {
      return;
    }
    await navigateAfterAuth(this.router, this.auth, this.business);
  }

  async onRegister(payload: UserRegisterRequest): Promise<void> {
    try {
      await this.auth.register(payload);
    } catch {
      return;
    }
    await navigateAfterAuth(this.router, this.auth, this.business);
  }

  onOauth(provider: OAuthProvider): void {
    window.location.href = this.auth.oauthLoginUrl(provider);
  }
}

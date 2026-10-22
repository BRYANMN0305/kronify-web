import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { apiErrorMessage, AuthStore } from '../../../../core/auth/auth.store';
import { BusinessStore } from '../../../../core/business/business.store';
import { navigateAfterAuth } from '../../../../core/auth/post-auth-navigation';
import { AuthLayout } from '../../../../layout/auth-layout/auth-layout';
import { ProfileType, ProfileTypeSelector } from '../../ui/profile-type-selector/profile-type-selector';

/** Callback del login OAuth (port de OAuthCallbackView.vue). */
@Component({
  selector: 'app-oauth-callback-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AuthLayout, ProfileTypeSelector],
  templateUrl: './oauth-callback-page.html',
})
export class OAuthCallbackPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly business = inject(BusinessStore);
  private readonly queryParams = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly error = signal('');
  readonly processing = signal(true);
  readonly profileType = signal<ProfileType | ''>('CLIENT');
  readonly savingProfile = signal(false);
  readonly profileError = signal('');

  constructor() {
    const params = this.queryParams;
    const token = params.get('token');
    const newProfile = params.get('newProfile');
    const oauthError = params.get('error');

    history.replaceState(null, '', window.location.pathname);

    if (oauthError) {
      this.error.set('No se pudo iniciar sesión con el proveedor. Intentá nuevamente.');
      this.processing.set(false);
      return;
    }

    if (!token) {
      this.error.set('Respuesta de autenticación inválida.');
      this.processing.set(false);
      return;
    }

    if (newProfile === 'true') {
      this.auth.finalizeOAuthLogin(token);
      this.processing.set(false);
      return;
    }

    this.auth.finalizeOAuthLogin(token);
    void navigateAfterAuth(this.router, this.auth, this.business);
  }

  goLogin(): void {
    this.router.navigate(['/iniciar-sesion']);
  }

  async submitProfile(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.profileType()) return;
    this.savingProfile.set(true);
    this.profileError.set('');
    try {
      await this.auth.completeOAuthProfile(this.profileType() as 'CLIENT' | 'BUSINESS');
      await navigateAfterAuth(this.router, this.auth, this.business);
    } catch (error) {
      this.profileError.set(apiErrorMessage(error));
      this.savingProfile.set(false);
    }
  }
}

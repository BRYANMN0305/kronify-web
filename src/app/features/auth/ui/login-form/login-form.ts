import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OAuthButtons, OAuthProvider } from '../oauth-buttons/oauth-buttons';
import { LoginRequest } from '../../../../core/api/openapi/model/loginRequest';

interface LoginValidationErrors {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formulario de inicio de sesión (port de LoginForm.vue, contrato por inputs/outputs). */
@Component({
  selector: 'app-login-form',
  imports: [FormsModule, OAuthButtons],
  templateUrl: './login-form.html',
})
export class LoginForm {
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly oauthRedirecting = input(false);

  readonly login = output<LoginRequest>();
  readonly switchToRegister = output<void>();
  readonly oauth = output<OAuthProvider>();

  readonly email = signal('');
  readonly password = signal('');
  readonly errors = signal<LoginValidationErrors>({ email: '', password: '' });

  protected validate(): boolean {
    const next: LoginValidationErrors = { email: '', password: '' };
    if (!this.email()) {
      next.email = 'El correo es obligatorio';
    } else if (!EMAIL_PATTERN.test(this.email())) {
      next.email = 'Formato de correo inválido';
    }
    if (!this.password()) {
      next.password = 'La contraseña es obligatoria';
    }
    this.errors.set(next);
    return !next.email && !next.password;
  }

  submit(): void {
    if (!this.validate()) return;
    this.login.emit({ email: this.email(), password: this.password() });
  }
}

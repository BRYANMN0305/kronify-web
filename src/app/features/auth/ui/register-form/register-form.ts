import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OAuthButtons, OAuthProvider } from '../oauth-buttons/oauth-buttons';
import { ProfileType, ProfileTypeSelector } from '../profile-type-selector/profile-type-selector';
import { UserRegisterRequest } from '../../../../core/api/openapi/model/userRegisterRequest';

interface RegisterValidationErrors {
  name: string;
  lastName: string;
  email: string;
  passwordHash: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/** Formulario de registro (port de RegisterForm.vue, contrato por inputs/outputs). */
@Component({
  selector: 'app-register-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, OAuthButtons, ProfileTypeSelector],
  templateUrl: './register-form.html',
})
export class RegisterForm {
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly oauthRedirecting = input.required<boolean>();

  readonly register = output<UserRegisterRequest>();
  readonly switchToLogin = output<void>();
  readonly oauth = output<OAuthProvider>();

  readonly name = signal('');
  readonly lastName = signal('');
  readonly phoneNumber = signal('');
  readonly email = signal('');
  readonly passwordHash = signal('');
  readonly profileTypeSignal = signal<ProfileType | ''>('CLIENT');
  readonly errors = signal<RegisterValidationErrors>({ name: '', lastName: '', email: '', passwordHash: '' });

  protected validate(): boolean {
    const next: RegisterValidationErrors = { name: '', lastName: '', email: '', passwordHash: '' };
    if (!this.name()) next.name = 'El nombre es obligatorio';
    if (!this.lastName()) next.lastName = 'El apellido es obligatorio';
    if (!this.email()) {
      next.email = 'El correo es obligatorio';
    } else if (!EMAIL_PATTERN.test(this.email())) {
      next.email = 'Formato de correo inválido';
    }
    if (!this.passwordHash()) {
      next.passwordHash = 'La contraseña es obligatoria';
    } else if (this.passwordHash().length < MIN_PASSWORD_LENGTH) {
      next.passwordHash = 'Mínimo 6 caracteres';
    }
    this.errors.set(next);
    return !next.name && !next.lastName && !next.email && !next.passwordHash;
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.validate()) return;
    if (!this.profileTypeSignal()) return; // igual que en Vue: perfil sin seleccionar no envía
    this.register.emit({
      name: this.name(),
      lastName: this.lastName(),
      phoneNumber: this.phoneNumber() || undefined,
      email: this.email(),
      passwordHash: this.passwordHash(),
      profileType: this.profileTypeSignal() as UserRegisterRequest['profileType'],
    } satisfies UserRegisterRequest);
  }
}

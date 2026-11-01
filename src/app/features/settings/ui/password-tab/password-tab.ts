import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UserChangePasswordRequest } from '../../../../core/api/openapi/model/userChangePasswordRequest';
import { Icon } from '../../../../shared/ui/icon/icon';

interface ValidationErrors {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

const NO_ERRORS: ValidationErrors = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Formulario presentacional de cambio de contraseña; el padre ejecuta la operación. */
@Component({
  selector: 'app-password-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon],
  templateUrl: './password-tab.html',
})
export class PasswordTab {
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly saveCompleted = input(0);

  readonly savePassword = output<UserChangePasswordRequest>();

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly errors = signal<ValidationErrors>(NO_ERRORS);

  private lastSaveCompleted = 0;

  constructor() {
    effect(() => {
      const completed = this.saveCompleted();
      if (completed > this.lastSaveCompleted && !this.saving()) {
        this.lastSaveCompleted = completed;
        this.resetForm();
      }
    });
  }

  protected submit(): void {
    const currentPassword = this.currentPassword();
    const newPassword = this.newPassword();
    const confirmPassword = this.confirmPassword();
    const errors: ValidationErrors = {
      currentPassword: currentPassword ? '' : 'Ingresa tu contraseña actual',
      newPassword: !newPassword
        ? 'La nueva contraseña es obligatoria'
        : newPassword.length < 8
          ? 'Mínimo 8 caracteres'
          : '',
      confirmPassword: !confirmPassword
        ? 'Confirma tu nueva contraseña'
        : confirmPassword !== newPassword
          ? 'Las contraseñas no coinciden'
          : '',
    };
    this.errors.set(errors);
    if (errors.currentPassword || errors.newPassword || errors.confirmPassword) return;

    this.savePassword.emit({ currentPassword, newPassword });
  }

  private resetForm(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.errors.set(NO_ERRORS);
  }
}

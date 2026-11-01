import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LinkedAuthMethodResponse } from '../../../../core/api/openapi/model/linkedAuthMethodResponse';
import { UserProfileResponse } from '../../../../core/api/openapi/model/userProfileResponse';
import { UserUpdateRequest } from '../../../../core/api/openapi/model/userUpdateRequest';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';

interface ValidationErrors {
  readonly name: string;
  readonly lastName: string;
}

const NO_ERRORS: ValidationErrors = { name: '', lastName: '' };

/** Formulario presentacional de datos personales; su padre se ocupa de guardar y cerrar sesión. */
@Component({
  selector: 'app-my-details-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DateFmtPipe, Icon],
  templateUrl: './my-details-tab.html',
  styleUrl: './my-details-tab.css',
})
export class MyDetailsTab {
  readonly profile = input.required<UserProfileResponse | null>();
  readonly authMethods = input.required<readonly LinkedAuthMethodResponse[]>();
  readonly role = input.required<string>();
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly saveCompleted = input(0);

  readonly editStarted = output<void>();
  readonly saveProfile = output<UserUpdateRequest>();
  readonly logout = output<void>();

  protected readonly editing = signal(false);
  protected readonly name = signal('');
  protected readonly lastName = signal('');
  protected readonly phoneNumber = signal('');
  protected readonly errors = signal<ValidationErrors>(NO_ERRORS);

  private lastSaveCompleted = 0;

  protected readonly initials = computed(() => {
    const profile = this.profile();
    const first = profile?.name?.trim()[0] ?? '';
    const last = profile?.lastName?.trim()[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  });

  protected readonly fullName = computed(() => {
    const profile = this.profile();
    const name = [profile?.name, profile?.lastName].filter(Boolean).join(' ').trim();
    return name || 'Usuario';
  });

  protected readonly email = computed(() => this.profile()?.email || '—');

  constructor() {
    effect(() => {
      const profile = this.profile();
      if (!this.editing()) this.fillForm(profile);
    });

    effect(() => {
      const completed = this.saveCompleted();
      if (completed > this.lastSaveCompleted && !this.saving()) {
        this.lastSaveCompleted = completed;
        this.editing.set(false);
        this.errors.set(NO_ERRORS);
      }
    });
  }

  protected startEdit(): void {
    this.fillForm(this.profile());
    this.errors.set(NO_ERRORS);
    this.editStarted.emit();
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.errors.set(NO_ERRORS);
  }

  protected submit(): void {
    const name = this.name().trim();
    const lastName = this.lastName().trim();
    const errors: ValidationErrors = {
      name: name ? '' : 'El nombre es obligatorio',
      lastName: lastName ? '' : 'El apellido es obligatorio',
    };
    this.errors.set(errors);
    if (errors.name || errors.lastName) return;

    this.saveProfile.emit({
      name,
      lastName,
      phoneNumber: this.phoneNumber().trim(),
    });
  }

  protected methodIcon(method: LinkedAuthMethodResponse): 'google' | 'microsoft' | null {
    const key = `${method.provider ?? ''} ${method.type ?? ''}`.toLowerCase();
    if (key.includes('google')) return 'google';
    if (key.includes('microsoft')) return 'microsoft';
    return null;
  }

  private fillForm(profile: UserProfileResponse | null): void {
    this.name.set(profile?.name ?? '');
    this.lastName.set(profile?.lastName ?? '');
    this.phoneNumber.set(profile?.phoneNumber ?? '');
  }
}

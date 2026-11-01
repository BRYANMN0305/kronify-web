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

import { BusinessSettingsResponse } from '../../../../core/api/openapi/model/businessSettingsResponse';
import { BusinessUpdateRequest } from '../../../../core/api/openapi/model/businessUpdateRequest';
import { CategoryDropdown } from '../../../onboarding/ui/category-dropdown/category-dropdown';
import { LogoUpload } from '../../../onboarding/ui/logo-upload/logo-upload';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';

/** Payload de edición: el logo puede ser un archivo nuevo, una URL existente o `null` para quitarlo. */
export interface BusinessProfileSubmitPayload {
  readonly request: Omit<BusinessUpdateRequest, 'logoUrl'> & { readonly logoUrl?: string | null };
  readonly logo: File | null;
}

interface ValidationErrors {
  readonly name: string;
  readonly email: string;
  readonly phoneNumber: string;
  readonly whatsApp: string;
}

const NO_ERRORS: ValidationErrors = { name: '', email: '', phoneNumber: '', whatsApp: '' };

/** Perfil público del negocio en modo lectura/edición; el padre resuelve logo y guardado. */
@Component({
  selector: 'app-profile-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CategoryDropdown, LogoUpload, DateFmtPipe, Icon],
  templateUrl: './profile-tab.html',
})
export class ProfileTab {
  readonly business = input<BusinessSettingsResponse | null>(null);
  readonly publicUrl = input('');
  readonly ownerAsEmployee = input(false);
  readonly toggling = input(false);
  readonly toggleError = input<string | null>(null);
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly saveCompleted = input(0);

  readonly editStarted = output<void>();
  readonly updateBusiness = output<BusinessProfileSubmitPayload>();
  readonly toggleOwner = output<boolean>();

  protected readonly editing = signal(false);
  protected readonly name = signal('');
  protected readonly category = signal('');
  protected readonly description = signal('');
  protected readonly address = signal('');
  protected readonly logoValue = signal<File | string | null>(null);
  protected readonly email = signal('');
  protected readonly phoneNumber = signal('');
  protected readonly whatsApp = signal('');
  protected readonly errors = signal<ValidationErrors>(NO_ERRORS);

  protected readonly businessInitial = computed(() => {
    const initial = this.business()?.name?.trim()[0] ?? '';
    return initial.toUpperCase() || 'N';
  });

  private lastSaveCompleted = 0;

  constructor() {
    // Mantiene el formulario sincronizado con el negocio guardado mientras no se edite.
    effect(() => {
      const business = this.business();
      if (!this.editing()) this.fillForm(business);
    });

    // Cierra la edición cuando el padre termina de guardar correctamente.
    effect(() => {
      const completed = this.saveCompleted();
      if (completed > this.lastSaveCompleted && !this.saving()) {
        this.lastSaveCompleted = completed;
        this.editing.set(false);
        this.fillForm(this.business());
      }
    });
  }

  protected startEdit(): void {
    this.fillForm(this.business());
    this.errors.set(NO_ERRORS);
    this.editStarted.emit();
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.errors.set(NO_ERRORS);
    this.fillForm(this.business());
  }

  protected toggleOwnerAsEmployee(enabled: boolean): void {
    this.toggleOwner.emit(enabled);
  }

  protected submit(): void {
    const name = this.name().trim();
    const email = this.email().trim();
    const phoneNumber = this.phoneNumber().trim();
    const whatsApp = this.whatsApp().trim();
    const errors: ValidationErrors = {
      name: name ? '' : 'El nombre del negocio es obligatorio',
      email: !email
        ? 'El email es obligatorio'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? 'Ingresa un email válido'
          : '',
      phoneNumber: phoneNumber ? '' : 'El teléfono es obligatorio',
      whatsApp: whatsApp ? '' : 'El WhatsApp es obligatorio',
    };
    this.errors.set(errors);
    if (errors.name || errors.email || errors.phoneNumber || errors.whatsApp) return;

    const logoValue = this.logoValue();
    const request: BusinessProfileSubmitPayload['request'] = {
      name,
      category: this.category().trim(),
      description: optionalText(this.description()),
      address: optionalText(this.address()),
      logoUrl: typeof logoValue === 'string' ? logoValue : undefined,
      email,
      phoneNumber,
      whatsApp,
      ownerWorksAsEmployee: this.ownerAsEmployee(),
    };
    this.updateBusiness.emit({
      request,
      logo: logoValue instanceof File ? logoValue : null,
    });
  }

  private fillForm(business: BusinessSettingsResponse | null): void {
    this.name.set(business?.name ?? '');
    this.category.set(business?.category ?? '');
    this.description.set(business?.description ?? '');
    this.address.set(business?.address ?? '');
    this.logoValue.set(business?.logoUrl ?? null);
    this.email.set(business?.email ?? '');
    this.phoneNumber.set(business?.phoneNumber ?? '');
    this.whatsApp.set(business?.whatsApp ?? '');
  }
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

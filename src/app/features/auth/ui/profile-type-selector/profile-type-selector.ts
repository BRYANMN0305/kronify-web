import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

const CLIENT = 'CLIENT';
const BUSINESS = 'BUSINESS';

export type ProfileType = typeof CLIENT | typeof BUSINESS;

/** Selector de tipo de perfil (CLIENT | BUSINESS) con estilo de tarjeta; port de ProfileTypeSelector.vue. */
@Component({
  selector: 'app-profile-type-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './profile-type-selector.html',
  styleUrl: './profile-type-selector.css',
})
export class ProfileTypeSelector {
  /** '' = sin selección (comportamiento del original) */
  readonly profileType = input.required<ProfileType | ''>();
  readonly profileTypeChange = output<ProfileType | ''>();

  readonly options = [
    { value: CLIENT, label: 'Cliente' },
    { value: BUSINESS, label: 'Negocio' },
  ] as const;

  select(value: ProfileType): void {
    this.profileTypeChange.emit(this.profileType() === value ? '' : value);
  }
}

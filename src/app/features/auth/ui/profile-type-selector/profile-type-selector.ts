import { Component, model } from '@angular/core';

const CLIENT = 'CLIENT';
const BUSINESS = 'BUSINESS';

export type ProfileType = typeof CLIENT | typeof BUSINESS;

/** Selector de tipo de perfil (CLIENT | BUSINESS) con estilo de tarjeta; port de ProfileTypeSelector.vue. */
@Component({
  selector: 'app-profile-type-selector',
  imports: [],
  templateUrl: './profile-type-selector.html',
  styleUrl: './profile-type-selector.css',
})
export class ProfileTypeSelector {
  /** v-model estilo Vue (`v-model="profileType"`); '' = sin selección (comportamiento del original) */
  readonly profileType = model<string>(CLIENT);

  readonly options = [
    { value: CLIENT, label: 'Cliente' },
    { value: BUSINESS, label: 'Negocio' },
  ] as const;

  select(value: ProfileType): void {
    this.profileType.set(this.profileType() === value ? '' : value);
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type OAuthProvider = 'google' | 'microsoft';

export interface OAuthProviderConfig {
  readonly id: OAuthProvider;
  readonly label: string;
  readonly icon: string;
}

export const OAUTH_PROVIDERS: readonly OAuthProviderConfig[] = [
  { id: 'google', label: 'Continuar con Google', icon: '/images/auth/google.svg' },
  { id: 'microsoft', label: 'Continuar con Microsoft', icon: '/images/auth/microsoft.svg' },
];

/** Botón reutilizable de proveedor OAuth (contrato por inputs/outputs). */
@Component({
  selector: 'app-oauth-provider-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './oauth-provider-button.html',
  styleUrl: './oauth-provider-button.css',
})
export class OAuthProviderButton {
  readonly provider = input.required<OAuthProviderConfig>();
  readonly disabled = input.required<boolean>();
  readonly selected = output<OAuthProvider>();
}

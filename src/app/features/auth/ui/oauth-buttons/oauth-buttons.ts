import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OAUTH_PROVIDERS, OAuthProviderButton } from '../oauth-provider-button/oauth-provider-button';
import type { OAuthProvider } from '../oauth-provider-button/oauth-provider-button';

export type { OAuthProvider } from '../oauth-provider-button/oauth-provider-button';

/** Agrupa los accesos de autenticación con Google y Microsoft. */
@Component({
  selector: 'app-oauth-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OAuthProviderButton],
  templateUrl: './oauth-buttons.html',
  styleUrl: './oauth-buttons.css',
})
export class OAuthButtons {
  readonly disabled = input.required<boolean>();
  readonly oauth = output<OAuthProvider>();

  protected readonly providers = OAUTH_PROVIDERS;
}

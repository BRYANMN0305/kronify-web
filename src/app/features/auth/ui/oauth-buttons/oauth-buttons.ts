import { Component, input, output } from '@angular/core';

export type OAuthProvider = 'google' | 'microsoft';

/** Botones de autenticación con Google/Microsoft (port de OAuthButtons.vue). */
@Component({
  selector: 'app-oauth-buttons',
  imports: [],
  templateUrl: './oauth-buttons.html',
  styleUrl: './oauth-buttons.css',
})
export class OAuthButtons {
  readonly disabled = input(false);
  readonly oauth = output<OAuthProvider>();
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  handleLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/iniciar-sesion']);
  }
}

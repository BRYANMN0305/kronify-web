import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EmployeeInvitationControllerService } from '../../../../core/api/openapi/api/employeeInvitationController.service';
import { apiErrorMessage, AuthStore, storePendingInvitation } from '../../../../core/auth/auth.store';
import { BusinessStore } from '../../../../core/business/business.store';
import { AuthLayout } from '../../../../layout/auth-layout/auth-layout';

@Component({
  selector: 'app-invitation-accept-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, RouterLink],
  templateUrl: './invitation-accept-page.html',
  styleUrl: './invitation-accept-page.css',
})
export class InvitationAcceptPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly business = inject(BusinessStore);
  private readonly invitationApi = inject(EmployeeInvitationControllerService);

  readonly token = computed(() => (this.route.snapshot.queryParamMap.get('token') ?? '').trim());
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly processing = signal(false);
  readonly resultOk = signal(false);
  readonly resultMessage = signal('');
  readonly resultError = signal('');

  ngOnInit(): void {
    if (!this.token() || !this.isAuthenticated()) return;
    void this.acceptInvitation();
  }

  goToRegister(): void {
    this.continueWithAccount('/registro');
  }

  goToLogin(): void {
    this.continueWithAccount('/iniciar-sesion');
  }

  goToCalendar(): void {
    void this.router.navigate(['/calendario']);
  }

  private continueWithAccount(path: '/registro' | '/iniciar-sesion'): void {
    storePendingInvitation(this.token());
    void this.router.navigate([path]);
  }

  private async acceptInvitation(): Promise<void> {
    this.processing.set(true);
    this.resultError.set('');
    try {
      await firstValueFrom(this.invitationApi.acceptInvitation({ token: this.token() }));
      this.resultOk.set(true);
      await this.refreshBusiness();
    } catch (error) {
      const message = apiErrorMessage(error);
      const alreadyLinked = /ya (eres|forma parte)|ya fue procesada|procesada/i.test(message);
      this.resultOk.set(alreadyLinked);
      this.resultMessage.set(
        alreadyLinked
          ? 'Tu cuenta ya está vinculada a este equipo.'
          : 'La invitación no pudo ser procesada.',
      );
      this.resultError.set(message);
      if (alreadyLinked) await this.refreshBusiness();
    } finally {
      this.processing.set(false);
    }
  }

  private async refreshBusiness(): Promise<void> {
    await this.business.fetchStatus().catch(() => undefined);
  }
}

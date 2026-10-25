import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore, apiErrorMessage } from '../../../../core/auth/auth.store';
import { BusinessStore } from '../../../../core/business/business.store';
import { BusinessCreateRequest } from '../../../../core/api/openapi/model/businessCreateRequest';
import { UploadControllerService } from '../../../../core/api/openapi/api/uploadController.service';
import { UploadFileRequest } from '../../../../core/api/openapi/model/uploadFileRequest';
import { OnboardingBusinessForm, OnboardingSubmitPayload } from '../../ui/onboarding-business-form/onboarding-business-form';

/**
 * Pantalla de `/onboarding-negocio`.
 * El formulario emite el payload validado; aquí se resuelve el logo (upload),
 * el createBusiness y el destino final.
 */
@Component({
  selector: 'app-onboarding-business-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OnboardingBusinessForm],
  templateUrl: './onboarding-business-page.html',
  styleUrl: './onboarding-business-page.css',
})
export class OnboardingBusinessPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly business = inject(BusinessStore);
  private readonly uploadApi = inject(UploadControllerService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  handleBack(): void {
    this.auth.logout();
    void this.router.navigate(['/iniciar-sesion']);
  }

  async onSubmitForm(payload: OnboardingSubmitPayload): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      // Un archivo nuevo se sube primero; una URL existente ya puede reutilizarse.
      let logoUrl: string | null = null;
      if (typeof payload.logo === 'string') {
        logoUrl = payload.logo;
      } else if (payload.logo instanceof File) {
        const response = await firstValueFrom(
          this.uploadApi.uploadFile({ file: payload.logo } satisfies UploadFileRequest),
        );
        logoUrl = response['url'] ?? null;
      }

      await this.business.createBusiness({
        name: payload.name,
        slug: payload.slug,
        category: payload.category,
        description: payload.description ?? undefined,
        address: payload.address ?? undefined,
        logoUrl: logoUrl ?? undefined,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        whatsApp: payload.whatsApp,
        openingHours: payload.openingHours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime,
        })),
        activationCode: payload.activationCode ?? undefined,
      } satisfies BusinessCreateRequest);

      this.router.navigate(['/calendario']);
    } catch (error) {
      this.errorMessage.set(apiErrorMessage(error) || 'Error al crear el negocio');
    } finally {
      this.submitting.set(false);
    }
  }
}

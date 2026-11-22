import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';

/**
 * Detalle de un servicio. El identificador llega como parámetro de ruta y se
 * entrega al componente mediante `input()` con `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-service-detail-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './service-detail-page.html',
  styleUrl: './service-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetailPage {
  private readonly api = inject(ServiceControllerService);

  /** El router entrega el `:id` como texto; `numberAttribute` lo convierte a número. */
  readonly id = input.required<number, string>({ transform: numberAttribute });

  protected readonly service = signal<ServiceResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Se vuelve a consultar si el usuario navega de un detalle a otro.
    effect(() => {
      const id = this.id();
      void this.load(id);
    });
  }

  protected async load(id: number): Promise<void> {
    if (!Number.isFinite(id) || id <= 0) {
      this.service.set(null);
      this.notFound.set(true);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(null);

    try {
      this.service.set(await firstValueFrom(this.api.getService(id)));
    } catch (err) {
      this.service.set(null);
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.notFound.set(true);
      } else {
        this.error.set('No se pudo cargar el servicio. Inténtalo de nuevo.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}

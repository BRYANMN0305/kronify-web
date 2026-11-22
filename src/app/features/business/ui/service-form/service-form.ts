import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { ServiceRequest } from '../../../../core/api/openapi/model/serviceRequest';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';
import { priceMultipleOf1000 } from '../../validators/price-multiple-of-1000.validator';

interface ServiceFormValue {
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
  readonly price: number;
}

const EMPTY_FORM: ServiceFormValue = {
  name: '',
  description: '',
  durationMinutes: 30,
  bufferMinutes: 0,
  price: 0,
};

/**
 * Formulario reactivo de alta y edición de servicios.
 * El padre decide qué hacer con el `ServiceRequest` emitido y cuándo reiniciar.
 */
@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './service-form.html',
  styleUrl: './service-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormComponent {
  private readonly fb = inject(FormBuilder);
  private lastInitial: ServiceResponse | null = null;

  readonly initial = input<ServiceResponse | null>(null);
  readonly saving = input(false);
  readonly save = output<ServiceRequest>();

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    durationMinutes: [30, [Validators.required, Validators.min(1), Validators.max(600)]],
    bufferMinutes: [0, [Validators.min(0), Validators.max(180)]],
    price: [0, [Validators.required, Validators.min(0), Validators.max(1000000), priceMultipleOf1000]],
  });

  constructor() {
    // Sincroniza el formulario cuando el padre elige otro servicio para editar.
    effect(() => {
      const initial = this.initial();
      if (initial === this.lastInitial) return;
      this.lastInitial = initial;
      if (!initial) {
        this.form.reset(EMPTY_FORM);
        return;
      }
      this.form.patchValue({
        name: initial.name ?? '',
        description: initial.description ?? '',
        durationMinutes: initial.durationMinutes ?? 30,
        bufferMinutes: initial.bufferMinutes ?? 0,
        price: initial.price ?? 0,
      });
    });
  }

  /** Los errores solo se muestran cuando el usuario ya tocó o modificó el control. */
  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.save.emit({
      name: value.name.trim(),
      description: value.description.trim(),
      durationMinutes: Number(value.durationMinutes),
      bufferMinutes: Number(value.bufferMinutes),
      price: Number(value.price),
    });
  }

  /** Restablece el formulario al estado de alta. */
  reset(): void {
    this.lastInitial = null;
    this.form.reset(EMPTY_FORM);
  }
}

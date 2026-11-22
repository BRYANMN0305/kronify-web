import type { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Regla de negocio del catálogo: el precio se publica en miles de pesos.
 * Un valor vacío se deja a `Validators.required` para no duplicar mensajes.
 */
export function priceMultipleOf1000(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') return null;

  const price = Number(raw);
  if (!Number.isFinite(price)) return null;

  return price % 1000 === 0 ? null : { multipleOf1000: true };
}

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { OnboardingProgressBar } from '../onboarding-progress-bar/onboarding-progress-bar';
import { OnboardingStepHeader } from '../onboarding-step-header/onboarding-step-header';
import { CategoryDropdown } from '../category-dropdown/category-dropdown';
import { LogoUpload } from '../logo-upload/logo-upload';

/** Fila de horario semanal (0..23 horas en formato HH:mm o vacío para cerrado) */
export interface HourRow {
  readonly dayOfWeek: number;
  readonly start: string;
  readonly end: string;
}

/** Payload listo para el submit — la página resuelve upload/logo y llamadas de API */
export interface OnboardingSubmitPayload {
  readonly name: string;
  readonly slug: string;
  readonly category: string;
  readonly description: string | null;
  readonly address: string | null;
  readonly logo: File | string | null;
  readonly email: string;
  readonly phoneNumber: string;
  readonly whatsApp: string;
  readonly openingHours: ReadonlyArray<{ dayOfWeek: number; startTime: string; endTime: string }>;
  readonly activationCode: string | null;
}

interface FormErrors {
  name: string;
  slug: string;
  category: string;
  email: string;
  phoneNumber: string;
  whatsApp: string;
}

const TOTAL_STEPS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WEEK_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const STEP_TITLES = ['Información básica', 'Contacto', 'Personalización', 'Horario de atención', 'Activación'] as const;
const STEP_DESCRIPTIONS = [
  'Lo esencial para identificar tu negocio',
  'Formas en que los clientes podrán contactarte',
  'Añade tu marca personal',
  'Los días y horas en que tu negocio está abierto',
  'Configura tu plan de servicio',
] as const;

const BLANK_ERRORS: FormErrors = { name: '', slug: '', category: '', email: '', phoneNumber: '', whatsApp: '' };

function generarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Port de onboarding/OnboardingBusinessForm.vue — wizard de 5 pasos, validación por paso.
 * Contrato: el form emite el payload validado; la página confirma (inputs submitting/errorMessage).
 */
@Component({
  selector: 'app-onboarding-business-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OnboardingProgressBar, OnboardingStepHeader, CategoryDropdown, LogoUpload],
  templateUrl: './onboarding-business-form.html',
  styleUrl: './onboarding-business-form.css',
})
export class OnboardingBusinessForm {
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitForm = output<OnboardingSubmitPayload>();

  readonly totalSteps = TOTAL_STEPS;
  readonly currentStep = signal(1);
  readonly direction = signal(1);

  readonly stepTitle = computed(() => STEP_TITLES[this.currentStep() - 1]);
  readonly stepDescription = computed(() => STEP_DESCRIPTIONS[this.currentStep() - 1]);
  readonly slideDirection = computed(() => (this.direction() === 1 ? 'slide-left' : 'slide-right'));

  // Campos del formulario (port de reactive form, uno por señal como exige el equipo)
  readonly name = signal('');
  readonly slug = signal('');
  readonly category = signal('');
  readonly description = signal('');
  readonly address = signal('');
  readonly logo = signal<File | string | null>(null);
  readonly email = signal('');
  readonly phoneNumber = signal('');
  readonly whatsApp = signal('');
  readonly activationCode = signal('');

  readonly errors = signal<FormErrors>({ ...BLANK_ERRORS });
  readonly hoursError = signal('');

  readonly hoursRows = signal<HourRow[]>(
    [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, start: '', end: '' })),
  );

  readonly weekLabels = WEEK_LABELS;

  /** autoSlug — slug sugerido mientras el usuario escribe el nombre (port de la heurística de Vue) */
  onNameInput(value: string): void {
    this.name.set(value);
    const auto = generarSlug(value);
    if (!this.slug() || this.slug().startsWith(auto) || this.slug() === generarSlug(value.slice(0, -1))) {
      this.slug.set(auto);
    }
  }

  setHourStart(dayOfWeek: number, value: string): void {
    this.updateRow(dayOfWeek, (row) => ({ ...row, start: value }));
  }

  setHourEnd(dayOfWeek: number, value: string): void {
    this.updateRow(dayOfWeek, (row) => ({ ...row, end: value }));
  }

  private updateRow(dayOfWeek: number, update: (row: HourRow) => HourRow): void {
    this.hoursRows.update((rows) => rows.map((row) => (row.dayOfWeek === dayOfWeek ? update(row) : row)));
  }

  nextStep(): void {
    if (!this.validateStep(this.currentStep())) return;
    this.direction.set(1);
    if (this.currentStep() < TOTAL_STEPS) this.currentStep.update((step) => step + 1);
  }

  prevStep(): void {
    this.direction.set(-1);
    if (this.currentStep() > 1) this.currentStep.update((step) => step - 1);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.validateStep(this.currentStep())) return;
    const configuredHours = this.hoursRows()
      .filter((row) => row.start && row.end)
      .map((row) => ({ dayOfWeek: row.dayOfWeek, startTime: `${row.start}:00`, endTime: `${row.end}:00` }));

    this.submitForm.emit({
      name: this.name().trim(),
      slug: this.slug().trim(),
      category: this.category().trim(),
      description: optionalText(this.description()),
      address: optionalText(this.address()),
      logo: this.logo(),
      email: this.email().trim(),
      phoneNumber: this.phoneNumber().trim(),
      whatsApp: this.whatsApp().trim(),
      openingHours: configuredHours,
      activationCode: optionalText(this.activationCode()),
    } satisfies OnboardingSubmitPayload);
  }

  private validateStep(step: number): boolean {
    this.errors.set({ ...BLANK_ERRORS });
    this.hoursError.set('');
    let valid = true;

    if (step === 1) {
      const next: FormErrors = { ...BLANK_ERRORS };
      if (!this.name().trim()) {
        next.name = 'El nombre del negocio es obligatorio';
        valid = false;
      }
      if (!this.slug().trim()) {
        next.slug = 'El slug es obligatorio';
        valid = false;
      } else if (!SLUG_PATTERN.test(this.slug())) {
        next.slug = 'Usa minúsculas, números y guiones sin espacios';
        valid = false;
      }
      if (!this.category().trim()) {
        next.category = 'Selecciona o escribe una categoría';
        valid = false;
      }
      this.errors.set(next);
    }

    if (step === 2) {
      const next: FormErrors = { ...BLANK_ERRORS };
      if (!this.email().trim()) {
        next.email = 'El email es obligatorio';
        valid = false;
      } else if (!EMAIL_PATTERN.test(this.email())) {
        next.email = 'Ingresa un email válido';
        valid = false;
      }
      if (!this.phoneNumber().trim()) {
        next.phoneNumber = 'El teléfono es obligatorio';
        valid = false;
      }
      if (!this.whatsApp().trim()) {
        next.whatsApp = 'El WhatsApp es obligatorio';
        valid = false;
      }
      this.errors.set(next);
    }

    if (step === 4) {
      const configured = this.hoursRows().filter((row) => row.start || row.end);
      if (configured.length === 0) {
        this.hoursError.set('Configura al menos un día de atención para que se puedan hacer reservas');
        valid = false;
      } else {
        for (const row of configured) {
          if (!row.start || !row.end) {
            this.hoursError.set(`Completa la hora de inicio y de fin de ${WEEK_LABELS[row.dayOfWeek - 1]}`);
            valid = false;
            break;
          }
          if (row.start >= row.end) {
            this.hoursError.set(`La hora de inicio debe ser menor que la de fin en ${WEEK_LABELS[row.dayOfWeek - 1]}`);
            valid = false;
            break;
          }
        }
      }
    }

    return valid;
  }
}

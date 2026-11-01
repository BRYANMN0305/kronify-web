import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Barra de progreso que indica el paso actual del onboarding. */
@Component({
  selector: 'app-onboarding-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="progress onboarding-progress mb-4"
      role="progressbar"
      [attr.aria-valuenow]="current()"
      aria-valuemin="0"
      [attr.aria-valuemax]="total()"
      [attr.aria-label]="'Progreso del onboarding: paso ' + current() + ' de ' + total()">
      <div class="progress-bar" [style.width.%]="(current() / total()) * 100"></div>
    </div>
  `,
  styles: `
    .onboarding-progress {
      --bs-progress-height: 4px;
      --bs-progress-bg: rgba(255, 255, 255, 0.08);
      --bs-progress-border-radius: 2px;
    }

    .onboarding-progress .progress-bar {
      --bs-progress-bar-bg: var(--neon);
      border-radius: 2px;
      transition: width 0.4s ease;
    }
  `,
})
export class OnboardingProgressBar {
  readonly current = input.required<number>();
  readonly total = input.required<number>();
}

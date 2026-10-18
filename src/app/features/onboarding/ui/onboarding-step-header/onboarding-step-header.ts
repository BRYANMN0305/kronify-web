import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Port de OnboardingStepHeader.vue */
@Component({
  selector: 'app-onboarding-step-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-header">
      <span class="step-counter">Paso {{ current() }} de {{ total() }}</span>
      <h2 class="step-title">{{ title() }}</h2>
      <p class="step-description">{{ description() }}</p>
    </div>
  `,
  styles: `
    .step-header {
      margin-bottom: 1.5rem;
    }

    .step-counter {
      display: block;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--neon-dim);
      margin-bottom: 0.35rem;
    }

    .step-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--color-text-label);
      margin: 0 0 0.25rem;
    }

    .step-description {
      font-size: 1rem;
      color: var(--color-text-muted);
      margin: 0;
    }
  `,
})
export class OnboardingStepHeader {
  readonly current = input.required<number>();
  readonly total = input.required<number>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}

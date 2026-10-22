import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Port de OnboardingStepHeader.vue */
@Component({
  selector: 'app-onboarding-step-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4">
      <span class="step-counter d-block small fw-semibold text-uppercase mb-1">
        Paso {{ current() }} de {{ total() }}
      </span>
      <h2 class="step-title fs-2 fw-bold mb-1">{{ title() }}</h2>
      <p class="step-description mb-0">{{ description() }}</p>
    </div>
  `,
  styles: `
    .step-counter {
      color: var(--neon-dim);
      font-size: 0.7rem;
      letter-spacing: 0.1em;
    }

    .step-title {
      color: var(--color-text-label);
    }

    .step-description {
      color: var(--color-text-muted);
    }
  `,
})
export class OnboardingStepHeader {
  readonly current = input.required<number>();
  readonly total = input.required<number>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}

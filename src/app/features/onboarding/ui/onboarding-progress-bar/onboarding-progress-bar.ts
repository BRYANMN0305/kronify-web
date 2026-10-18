import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Port de OnboardingProgressBar.vue */
@Component({
  selector: 'app-onboarding-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress-bar">
      <div class="progress-fill" [style.width.%]="(current() / total()) * 100"></div>
    </div>
  `,
  styles: `
    .progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--neon);
      border-radius: 2px;
      transition: width 0.4s ease;
    }
  `,
})
export class OnboardingProgressBar {
  readonly current = input.required<number>();
  readonly total = input.required<number>();
}

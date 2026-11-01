import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ArcElement, Chart, ChartConfiguration, Tooltip } from 'chart.js';

Chart.register(ArcElement, Tooltip);
Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
Chart.defaults.font.family = 'inherit';

/** Doughnut de una métrica de uso; crea y actualiza la instancia de Chart.js. */
@Component({
  selector: 'app-usage-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas [attr.aria-label]="label()" role="img"></canvas>`,
  styles: [':host { display: block; width: 100%; height: 100%; } canvas { display: block; }'],
})
export class UsageChart {
  readonly label = input('');
  readonly data = input.required<ChartConfiguration<'doughnut'>['data']>();
  readonly options = input<ChartConfiguration<'doughnut'>['options']>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart<'doughnut'> | null = null;

  constructor() {
    afterNextRender(() => {
      this.chart = new Chart(this.canvasRef().nativeElement, {
        type: 'doughnut',
        data: this.data(),
        options: { ...this.options(), responsive: true, maintainAspectRatio: false },
      });
    });

    effect(() => {
      const data = this.data();
      if (this.chart) {
        this.chart.data = data;
        this.chart.update();
      }
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}

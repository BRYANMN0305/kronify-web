import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado puramente visual con los indicadores calculados por la página. */
@Component({
  selector: 'app-agenda-summary',
  standalone: true,
  template: `
    <section class="summary-card" aria-label="Resumen de agenda">
      <span class="summary-icon">◷</span>
      <div><strong>{{ confirmed() }} <small>de {{ total() }}</small></strong><span>citas confirmadas</span></div>
      <span class="summary-divider"></span>
      <div><strong>{{ revenue() }}</strong><span>ingreso potencial de hoy</span></div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSummary {
  readonly confirmed = input.required<number>();
  readonly total = input.required<number>();
  readonly revenue = input.required<string>();
}

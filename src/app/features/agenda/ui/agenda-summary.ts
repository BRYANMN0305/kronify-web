import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Resumen de métricas de agenda en tarjetas visualmente independientes. */
@Component({
  selector: 'app-agenda-summary',
  standalone: true,
  template: `
    <section class="summary-grid" aria-label="Resumen de agenda">
      <article class="summary-card">
        <span class="summary-icon appointments-icon" aria-hidden="true">◷</span>
        <div class="summary-copy">
          <span class="summary-label">CITAS CONFIRMADAS</span>
          <strong>{{ confirmed() }} <small>/ {{ total() }}</small></strong>
          <span class="summary-caption">Confirmadas en esta agenda</span>
        </div>
      </article>
      <article class="summary-card revenue-card">
        <span class="summary-icon revenue-icon" aria-hidden="true">$</span>
        <div class="summary-copy">
          <span class="summary-label">INGRESO POTENCIAL</span>
          <strong>{{ revenue() }}</strong>
          <span class="summary-caption">De las citas no canceladas</span>
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSummary {
  readonly confirmed = input.required<number>();
  readonly total = input.required<number>();
  readonly revenue = input.required<string>();
}

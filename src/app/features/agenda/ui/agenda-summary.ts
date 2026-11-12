import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Resumen de la agenda calculado únicamente con las citas que devuelve la API. */
@Component({
  selector: 'app-agenda-summary',
  standalone: true,
  template: `
    <section class="summary-grid" aria-label="Resumen de agenda">
      <article class="summary-card appointments-card">
        <span class="summary-icon appointments-icon" aria-hidden="true">◷</span>
        <div class="summary-copy">
          <span class="summary-label">CITAS DEL MES</span>
          <strong>{{ total() }}</strong>
          <span class="summary-caption">Agendadas en el periodo visible</span>
        </div>
      </article>
      <article class="summary-card confirmed-card">
        <span class="summary-icon confirmed-icon" aria-hidden="true">✓</span>
        <div class="summary-copy">
          <span class="summary-label">CONFIRMADAS</span>
          <strong>{{ confirmed() }}</strong>
          <span class="summary-caption">Listas para atender</span>
        </div>
      </article>
      <article class="summary-card pending-card">
        <span class="summary-icon pending-icon" aria-hidden="true">◔</span>
        <div class="summary-copy">
          <span class="summary-label">PENDIENTES</span>
          <strong>{{ pending() }}</strong>
          <span class="summary-caption">Esperando confirmación</span>
        </div>
      </article>
      <article class="summary-card completed-card">
        <span class="summary-icon completed-icon" aria-hidden="true">✔</span>
        <div class="summary-copy">
          <span class="summary-label">COMPLETADAS</span>
          <strong>{{ completed() }}</strong>
          <span class="summary-caption">Atendidas en el periodo</span>
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSummary {
  readonly total = input.required<number>();
  readonly confirmed = input.required<number>();
  readonly pending = input.required<number>();
  readonly completed = input.required<number>();
}

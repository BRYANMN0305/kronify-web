import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgendaStore } from '../data/agenda.store';

/** Lectura del estado global desde el shell, fuera de AgendaPage. */
@Component({
  selector: 'app-agenda-state-header',
  standalone: true,
  template: `
    <div class="agenda-state-header" aria-label="Estado compartido de la agenda">
      <span>Agenda compartida</span>
      <strong>{{ store.confirmedCount() }} de {{ store.appointmentCount() }} confirmadas</strong>
      @if (store.isDemo()) { <small>Datos locales</small> }
    </div>
  `,
  styles: [`:host{display:block}.agenda-state-header{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:8px 40px;color:#a9c4cb;font-size:11px}.agenda-state-header strong{color:#dff7fb}.agenda-state-header small{border:1px solid #315763;border-radius:99px;padding:3px 8px;color:#62d8ec}@media(max-width:760px){.agenda-state-header{padding:6px 12px;font-size:10px}}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaStateHeader {
  protected readonly store = inject(AgendaStore);
}

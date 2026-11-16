import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthStore } from '../../../../core/auth/auth.store';
import { ClientCalendarPage } from '../../../client/pages/client-calendar-page/client-calendar-page';
import { AgendaPage } from '../agenda-page/agenda-page';

/**
 * Entrada de /calendario: el cliente ve su calendario personal y el negocio
 * (dueño o empleado) ve la agenda operativa completa.
 */
@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [AgendaPage, ClientCalendarPage],
  template: `
    @if (isClient()) {
      <app-client-calendar-page />
    } @else {
      <app-agenda-page />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly auth = inject(AuthStore);
  protected readonly isClient = computed(() => this.auth.profileType() === 'CLIENT');
}

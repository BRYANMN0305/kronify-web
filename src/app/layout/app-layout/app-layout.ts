import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNav } from './bottom-nav/bottom-nav';
import { Sidebar } from './sidebar/sidebar';
import { AgendaStateHeader } from '../../features/agenda/ui/agenda-state-header';

/**
 * AppLayout — Layout principal de las vistas autenticadas (equivalente de AppLayout.vue):
 * Sidebar fijo a la izquierda (desktop) + contenido a la derecha + BottomNav en mobile.
 * Owned por A; B agrega sus children en app.routes.ts.
 */
@Component({
  selector: 'app-app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, BottomNav, AgendaStateHeader],
  template: `
    <div class="app-shell">
      <app-sidebar/>
      <main class="app-main">
        <app-agenda-state-header />
        <router-outlet/>
      </main>
      <app-bottom-nav/>
    </div>
  `,
})
export class AppLayout {}

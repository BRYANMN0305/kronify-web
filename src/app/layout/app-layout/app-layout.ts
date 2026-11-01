import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNav } from './bottom-nav/bottom-nav';
import { Sidebar } from './sidebar/sidebar';

/**
 * AppLayout — Marco principal de las vistas autenticadas:
 * Sidebar fijo a la izquierda (desktop) + contenido a la derecha + BottomNav en mobile.
 * Owned por A; B agrega sus children en app.routes.ts.
 */
@Component({
  selector: 'app-app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar, BottomNav],
  template: `
    <div class="app-shell">
      <app-sidebar/>
      <main class="app-main">
        <router-outlet/>
      </main>
      <app-bottom-nav/>
    </div>
  `,
})
export class AppLayout {}

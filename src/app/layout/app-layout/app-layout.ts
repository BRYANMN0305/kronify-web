import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Shell de rutas autenticadas — owned A; los children reales los agrega B en app.routes. */
@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppLayout {}

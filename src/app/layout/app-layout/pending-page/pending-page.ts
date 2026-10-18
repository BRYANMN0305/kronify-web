import { Component, input } from '@angular/core';

/** Página provisional mientras cada feature console migra (marcada con TODO en app.routes). */
@Component({
  selector: 'app-pending-page',
  imports: [],
  templateUrl: './pending-page.html',
  styleUrl: './pending-page.css',
})
export class PendingPage {
  readonly title = input.required<string>();
}

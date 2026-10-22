import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Reloj decorativo tipo hourglass orbital del panel izquierdo de auth. */
@Component({
  selector: 'app-chrono-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './chrono-clock.html',
  styleUrl: './chrono-clock.css',
})
export class ChronoClock {
  readonly size = input(380);
}

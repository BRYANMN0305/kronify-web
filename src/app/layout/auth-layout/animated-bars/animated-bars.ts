import { Component, DestroyRef, inject, signal } from '@angular/core';

/** Tagline rotativo + 3 barritas indicadoras del panel izquierdo de auth. */
@Component({
  selector: 'app-animated-bars',
  imports: [],
  templateUrl: './animated-bars.html',
  styleUrl: './animated-bars.css',
})
export class AnimatedBars {
  private static readonly TAGLINES = [
    'Tu agenda, sin complicaciones',
    'Reservas simples, negocios fuertes',
    'Cada cita en su lugar',
    'Tu negocio, siempre a tiempo',
    'Agenda rápida, clientes felices',
    'Tu horario bajo control',
  ] as const;
  private static readonly ROTATE_MS = 7000;

  private readonly destroyRef = inject(DestroyRef);

  readonly taglines = AnimatedBars.TAGLINES;
  readonly current = signal(0);
  readonly bars = [1, 2, 3] as const;

  constructor() {
    const interval = setInterval(() => {
      this.current.set((this.current() + 1) % this.taglines.length);
    }, AnimatedBars.ROTATE_MS);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';
import { AppointmentStatusClassPipe } from './appointment-status.pipe';

@Component({
  selector: 'app-appointment-row',
  standalone: true,
  imports: [CurrencyPipe, AppointmentStatusClassPipe],
  template: `
    <article class="appointment-row">
      <div class="appointment-time"><strong>{{ appointment().time }}</strong><span>{{ appointment().durationMinutes }} min</span></div>
      <div class="appointment-person"><span class="avatar">{{ initials() }}</span><div><strong>{{ appointment().client }}</strong><small>{{ appointment().service }} · {{ appointment().employee }}</small></div></div>
      <div class="appointment-price">@if (appointment().price !== undefined) { {{ appointment().price | currency:'COP':'symbol-narrow':'1.0-0':'es-CO' }} } @else { <span aria-label="Precio no disponible">—</span> }</div>
      <div class="appointment-actions">
        <span class="status-pill" [class]="appointment().status | appointmentStatusClass">{{ appointment().status }}</span>
        @if (appointment().status === 'Pendiente') {
          <button class="confirm-button" type="button" (click)="statusChange.emit('Confirmada')" aria-label="Confirmar cita">✓</button>
        }
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentRow {
  readonly appointment = input.required<Appointment>();
  readonly statusChange = output<AppointmentStatus>();

  protected initials(): string {
    return this.appointment().client.split(' ').slice(0, 2).map((part) => part[0]).join('');
  }
}

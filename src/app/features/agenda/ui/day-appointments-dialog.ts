import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import type { Appointment, AppointmentStatus } from '../modelos/appointment.model';
import { AppointmentRow } from './appointment-row';

/** Muestra en una ventana las citas y los datos del día elegido en el calendario. */
@Component({
  selector: 'app-day-appointments-dialog', standalone: true,
  imports: [DatePipe, TitleCasePipe, AppointmentRow],
  template: `
    <div class="day-dialog-backdrop" (click)="closed.emit()">
      <section class="day-dialog" role="dialog" aria-modal="true" aria-labelledby="day-dialog-title" (click)="$event.stopPropagation()">
        <header><div><span class="day-dialog-eyebrow">CITAS DEL DÍA</span><h2 id="day-dialog-title">{{ date() | date:'EEEE, d MMMM y':'':'es-CO' | titlecase }}</h2><p>{{ appointments().length }} {{ appointments().length === 1 ? 'cita' : 'citas' }}</p></div><button type="button" class="day-dialog-close" aria-label="Cerrar" (click)="closed.emit()">×</button></header>
        <div class="day-dialog-list">
          @for (appointment of appointments(); track appointment.id) {
            <div class="day-dialog-item"><app-appointment-row [appointment]="appointment" (statusChange)="statusChange.emit({ id: appointment.id, status: $event })"/><p class="appointment-description">{{ appointment.description || appointment.service }}</p></div>
          } @empty { <p class="day-dialog-empty">No hay citas para este día con los filtros seleccionados.</p> }
        </div>
        <footer><button type="button" class="day-dialog-done" (click)="closed.emit()">Listo</button></footer>
      </section>
    </div>
  `,
  styles: [`
    .day-dialog-backdrop{position:fixed;inset:0;z-index:1040;display:grid;place-items:center;background:#061115cc;padding:18px}
    .day-dialog{width:min(100%,760px);max-height:90vh;overflow:auto;border:1px solid #31535d;border-radius:16px;background:#10252c;color:#eff9fb;box-shadow:0 24px 80px #0008}
    .day-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #23414b;padding:20px 22px}
    .day-dialog-eyebrow{color:#39d6f1;font-size:10px;font-weight:800;letter-spacing:.15em}
    .day-dialog h2{margin:5px 0;color:white;font-size:21px;text-transform:capitalize}
    .day-dialog header p{margin:0;color:#9cb5bb;font-size:12px}
    .day-dialog-close{border:0;background:none;color:#a9c2c8;font-size:28px;cursor:pointer}
    .day-dialog-list{padding:0 20px}
    .day-dialog-item{border-bottom:1px solid #203b44;padding:12px 0}
    .day-dialog-item .appointment-row{grid-template-columns:76px minmax(180px,1fr) 120px 150px;padding:5px 0}
    .appointment-description{margin:8px 0 0 76px;color:#91aeb5;font-size:12px}
    .day-dialog-empty{padding:20px;color:#9cb5bb}
    .day-dialog footer{display:flex;justify-content:flex-end;padding:14px 20px}
    .day-dialog-done{border:1px solid #32cde7;border-radius:8px;background:#176071;padding:9px 16px;color:white;font-weight:700;cursor:pointer}
    @media(max-width:600px){.day-dialog{max-height:94vh}.day-dialog>header{padding:16px}.day-dialog-list{padding:0 12px}.day-dialog-item .appointment-row{grid-template-columns:55px minmax(110px,1fr) 90px;padding:5px 0}.day-dialog-item .appointment-price{display:none}.appointment-description{margin-left:55px}.day-dialog footer{padding:12px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayAppointmentsDialog {
  readonly date = input.required<Date>();
  readonly appointments = input.required<readonly Appointment[]>();
  readonly closed = output<void>();
  readonly statusChange = output<{ id: number; status: AppointmentStatus }>();
}

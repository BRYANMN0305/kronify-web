import { Pipe, PipeTransform } from '@angular/core';
import type { AppointmentStatus } from '../modelos/appointment.model';

/** Convierte el estado de una cita en la clase visual correspondiente. */
@Pipe({ name: 'appointmentStatusClass', standalone: true })
export class AppointmentStatusClassPipe implements PipeTransform {
  transform(status: AppointmentStatus): string {
    switch (status) {
      case 'Confirmada': return 'status-confirmed';
      case 'Pendiente': return 'status-pending';
      case 'Completada': return 'status-completed';
      case 'Cancelada': return 'status-cancelled';
    }
  }
}

import type { Appointment } from '../modelos/appointment.model';

/** Registros sintéticos usados solo por /demo-calendario y como respaldo sin API. */
export const SAMPLE_APPOINTMENTS: readonly Appointment[] = [
  { id: 1, client: 'Valentina Rojas', service: 'Corte y peinado', employee: 'Camila Torres', time: '08:30', durationMinutes: 60, price: 65000, status: 'Confirmada' },
  { id: 2, client: 'Mariana Pérez', service: 'Manicure semipermanente', employee: 'Laura Gómez', time: '09:00', durationMinutes: 75, price: 55000, status: 'Confirmada' },
  { id: 3, client: 'Sofía Martínez', service: 'Coloración', employee: 'Camila Torres', time: '10:00', durationMinutes: 120, price: 180000, status: 'Pendiente' },
  { id: 4, client: 'Isabella Castro', service: 'Diseño de cejas', employee: 'Laura Gómez', time: '11:30', durationMinutes: 30, price: 35000, status: 'Completada' },
  { id: 5, client: 'Luciana Herrera', service: 'Pedicure spa', employee: 'Daniela Ruiz', time: '12:00', durationMinutes: 60, price: 70000, status: 'Confirmada' },
  { id: 6, client: 'Gabriela Díaz', service: 'Limpieza facial', employee: 'Daniela Ruiz', time: '14:00', durationMinutes: 90, price: 95000, status: 'Pendiente' },
  { id: 7, client: 'Paula Mendoza', service: 'Corte de puntas', employee: 'Camila Torres', time: '15:30', durationMinutes: 45, price: 45000, status: 'Cancelada' },
  { id: 8, client: 'Manuela Silva', service: 'Manicure tradicional', employee: 'Laura Gómez', time: '16:30', durationMinutes: 45, price: 40000, status: 'Confirmada' },
];

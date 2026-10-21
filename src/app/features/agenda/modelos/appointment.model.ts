export type AppointmentStatus = 'Confirmada' | 'Pendiente' | 'Completada' | 'Cancelada';

export interface Appointment {
  readonly id: number;
  readonly client: string;
  readonly service: string;
  readonly employee: string;
  readonly time: string;
  readonly dateKey?: string;
  readonly durationMinutes: number;
  readonly price?: number;
  readonly status: AppointmentStatus;
}

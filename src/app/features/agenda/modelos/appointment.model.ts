/** Estados que entiende la interfaz; el store adapta los valores técnicos del backend. */
export type AppointmentStatus = 'Confirmada' | 'Pendiente' | 'Completada' | 'Cancelada' | 'No asistió';

/** Cita preparada para mostrar en calendario, lista y métricas. */
export interface Appointment {
  readonly id: number;
  readonly businessId?: number;
  readonly serviceId?: number;
  readonly employeeId?: number;
  readonly client: string;
  readonly phone?: string;
  readonly email?: string;
  readonly service: string;
  readonly description?: string;
  readonly employee: string;
  readonly time: string;
  readonly endTime?: string;
  readonly dateKey?: string;
  readonly startAt?: string;
  readonly durationMinutes: number;
  readonly price?: number;
  readonly status: AppointmentStatus;
  readonly origin?: 'PUBLIC' | 'PRIVATE';
}

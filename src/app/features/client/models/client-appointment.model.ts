/** Estado técnico que devuelve el backend para una cita. */
export type ClientAppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/** Cita del cliente autenticado, lista para las vistas de historial y calendario. */
export interface ClientAppointment {
  readonly id: number;
  readonly businessId?: number;
  readonly serviceId?: number;
  readonly employeeId?: number;
  readonly serviceName: string;
  readonly serviceDurationMinutes: number;
  readonly employeeName: string;
  readonly startAt: string;
  readonly endAt?: string;
  readonly status: ClientAppointmentStatus;
  readonly origin?: 'PUBLIC' | 'PRIVATE';
  readonly customerName?: string;
  readonly customerPhone?: string;
  readonly customerEmail?: string;
}

/** Negocio donde el cliente ya agendó; se usa en el acceso rápido de "Mis citas". */
export interface RecentBusiness {
  readonly businessId: number;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl?: string;
  readonly category?: string;
  readonly address?: string;
  readonly lastAppointmentAt?: string;
}

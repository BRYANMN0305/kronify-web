import type { AppointmentResponse } from '../api/openapi/model/appointmentResponse';

export const PUBLIC_APPOINTMENT_CREATED_KEY = 'kronify:public-appointment-created';

export interface PublicAppointmentCreatedEvent {
  readonly appointmentId?: number;
  readonly businessId?: number;
  readonly startAt?: string;
  readonly createdAt: number;
}

/** Notifica a otras pestañas del mismo origen después de que el backend guardó la cita. */
export function announcePublicAppointmentCreated(appointment: AppointmentResponse): void {
  try {
    localStorage.setItem(PUBLIC_APPOINTMENT_CREATED_KEY, JSON.stringify({
      appointmentId: appointment.appointmentId,
      businessId: appointment.businessId,
      startAt: appointment.startAt,
      createdAt: Date.now(),
    } satisfies PublicAppointmentCreatedEvent));
  } catch {
    // La reserva ya quedó persistida en backend; la agenda la recuperará en su próxima carga.
  }
}

export function readPublicAppointmentCreatedEvent(value: string | null): PublicAppointmentCreatedEvent | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const event = parsed as Partial<PublicAppointmentCreatedEvent>;
    if (typeof event.createdAt !== 'number') return null;
    return { ...event, createdAt: event.createdAt };
  } catch { return null; }
}

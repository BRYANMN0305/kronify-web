import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppointmentControllerService } from '../../../../core/api/openapi/api/appointmentController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';

/** Captura los datos mínimos para registrar una cita privada desde la agenda. */
@Component({
  selector: 'app-create-appointment-page', standalone: true, imports: [FormsModule, RouterLink],
  templateUrl: './create-appointment-page.html', styleUrl: './create-appointment-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAppointmentPage implements OnInit {
  private readonly appointmentsApi = inject(AppointmentControllerService);
  private readonly employeesApi = inject(EmployeeControllerService);
  private readonly servicesApi = inject(ServiceControllerService);
  private readonly router = inject(Router);
  protected readonly services = signal<readonly ServiceResponse[]>([]);
  protected readonly employees = signal<readonly EmployeeResponse[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal({ serviceId: '', employeeId: '', startAt: '', customerName: '', customerLastName: '', customerPhone: '', customerEmail: '' });

  ngOnInit(): void {
    void Promise.all([
      firstValueFrom(this.servicesApi.listServices()).then((items) => this.services.set((items ?? []).filter((item) => item.active !== false && item.id != null))).catch(() => this.error.set('No se pudieron cargar los servicios.')),
      firstValueFrom(this.employeesApi.listEmployees()).then((items) => this.employees.set((items ?? []).filter((item) => item.active !== false && item.employeeId != null))).catch(() => this.error.set('No se pudieron cargar los profesionales.')),
    ]);
  }
  protected update<K extends keyof ReturnType<typeof this.form>>(field: K, value: ReturnType<typeof this.form>[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }
  protected cancel(): void { void this.router.navigate(['/calendario']); }
  protected async submit(): Promise<void> {
    const value = this.form();
    if (!value.serviceId || !value.employeeId || !value.startAt || !value.customerName.trim()) {
      this.error.set('Completa servicio, profesional, fecha y nombre del cliente.');
      return;
    }
    this.busy.set(true); this.error.set(null);
    try {
      await firstValueFrom(this.appointmentsApi.createAppointment({
        serviceId: Number(value.serviceId), employeeId: Number(value.employeeId),
        startAt: new Date(value.startAt).toISOString(), customerName: value.customerName.trim(),
        customerLastName: value.customerLastName.trim() || undefined,
        customerPhone: value.customerPhone.trim() || undefined,
        customerEmail: value.customerEmail.trim() || undefined,
      }));
      await this.router.navigate(['/calendario']);
    } catch {
      this.error.set('No se pudo crear la cita. Verifica que el horario esté disponible e inténtalo otra vez.');
    } finally { this.busy.set(false); }
  }
}

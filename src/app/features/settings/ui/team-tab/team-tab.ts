import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import { InvitationResponse } from '../../../../core/api/openapi/model/invitationResponse';
import { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';

const STATUS_META: Record<string, { readonly label: string; readonly cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'status-pending' },
  ACCEPTED: { label: 'Aceptada', cls: 'status-accepted' },
  CANCELLED: { label: 'Cancelada', cls: 'status-cancelled' },
  EXPIRED: { label: 'Expirada', cls: 'status-expired' },
};

/** Gestión presentacional del equipo; el padre ejecuta las operaciones del API. */
@Component({
  selector: 'app-team-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DateFmtPipe, Icon],
  templateUrl: './team-tab.html',
})
export class TeamTab {
  readonly invitations = input.required<readonly InvitationResponse[]>();
  readonly employees = input<readonly EmployeeResponse[]>([]);
  readonly services = input<readonly ServiceResponse[]>([]);
  readonly employeeServices = input<Readonly<Record<number, readonly ServiceResponse[]>>>({});
  readonly expandedEmployeeId = input<number | null>(null);
  readonly serviceBusyId = input<number | null>(null);
  readonly permissionBusyId = input<number | null>(null);
  readonly employeeError = input<string | null>(null);
  readonly sending = input(false);
  readonly busyId = input<number | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);

  readonly createInvitation = output<string>();
  readonly resendInvitation = output<number>();
  readonly cancelInvitation = output<number>();
  readonly toggleEmployeePanel = output<number>();
  readonly addEmployeeService = output<{ employeeId: number; serviceId: number }>();
  readonly removeEmployeeService = output<{ employeeId: number; serviceId: number }>();
  readonly schedulePermission = output<{ employeeId: number; enabled: boolean }>();

  protected readonly showForm = signal(false);
  protected readonly email = signal('');
  protected readonly emailError = signal('');

  constructor() {
    effect(() => {
      if (this.successMessage()) {
        this.email.set('');
        this.emailError.set('');
        this.showForm.set(false);
      }
    });
  }

  protected submit(): void {
    const email = this.email().trim();
    const error = !email
      ? 'El correo es obligatorio'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Formato de correo inválido'
        : '';
    this.emailError.set(error);
    if (error) return;
    this.createInvitation.emit(email);
  }

  protected canResend(invitation: InvitationResponse): boolean {
    return invitation.status === 'PENDING' && invitation.invitationId != null;
  }

  protected statusLabel(status?: string): string {
    return status ? (STATUS_META[status]?.label ?? status) : '—';
  }

  protected statusClass(status?: string): string {
    return status ? (STATUS_META[status]?.cls ?? 'status-default') : 'status-default';
  }

  protected employeeName(employee: EmployeeResponse): string {
    return `${employee.name ?? ''} ${employee.lastName ?? ''}`.trim() || 'Sin nombre';
  }

  protected initials(employee: EmployeeResponse): string {
    const first = employee.name?.trim()[0] ?? '';
    const last = employee.lastName?.trim()[0] ?? '';
    return (first + last).toUpperCase() || 'E';
  }

  protected assignedServices(employeeId?: number): readonly ServiceResponse[] {
    if (employeeId == null) return [];
    return this.employeeServices()[employeeId] ?? [];
  }

  protected isAssigned(employeeId: number | undefined, serviceId: number | undefined): boolean {
    if (employeeId == null || serviceId == null) return false;
    return this.assignedServices(employeeId).some((service) => service.id === serviceId);
  }

  protected servicesLoaded(employeeId?: number): boolean {
    return employeeId != null && this.employeeServices()[employeeId] !== undefined;
  }

  protected togglePanel(employeeId?: number): void {
    if (employeeId != null) this.toggleEmployeePanel.emit(employeeId);
  }

  protected toggleService(employeeId: number | undefined, serviceId: number | undefined, checked: boolean): void {
    if (employeeId == null || serviceId == null) return;
    if (checked) this.addEmployeeService.emit({ employeeId, serviceId });
    else this.removeEmployeeService.emit({ employeeId, serviceId });
  }

  protected permissionChanged(employee: EmployeeResponse, checked: boolean): void {
    if (employee.employeeId == null || employee.owner) return;
    this.schedulePermission.emit({ employeeId: employee.employeeId, enabled: checked });
  }
}

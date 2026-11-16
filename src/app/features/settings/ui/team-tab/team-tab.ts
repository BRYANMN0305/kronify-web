import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import { InvitationResponse } from '../../../../core/api/openapi/model/invitationResponse';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';

const STATUS_META: Record<string, { readonly label: string; readonly cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'status-pending' },
  ACCEPTED: { label: 'Aceptada', cls: 'status-accepted' },
  CANCELLED: { label: 'Cancelada', cls: 'status-cancelled' },
  EXPIRED: { label: 'Expirada', cls: 'status-expired' },
};

type MemberAction = 'deactivate' | 'delete';

/** Gestión presentacional del equipo; el padre ejecuta las operaciones del API.
 *  Los servicios de cada integrante se asignan en la vista Horarios (pestaña Servicios). */
@Component({
  selector: 'app-team-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DateFmtPipe, Icon],
  templateUrl: './team-tab.html',
})
export class TeamTab {
  readonly invitations = input.required<readonly InvitationResponse[]>();
  readonly employees = input<readonly EmployeeResponse[]>([]);
  readonly permissionBusyId = input<number | null>(null);
  readonly employeeError = input<string | null>(null);
  readonly sending = input(false);
  readonly busyId = input<number | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);

  readonly createInvitation = output<string>();
  readonly resendInvitation = output<number>();
  readonly cancelInvitation = output<number>();
  readonly schedulePermission = output<{ employeeId: number; enabled: boolean }>();
  readonly deactivateEmployee = output<number>();
  readonly reactivateEmployee = output<number>();
  readonly deleteEmployee = output<number>();

  protected readonly showForm = signal(false);
  protected readonly email = signal('');
  protected readonly emailError = signal('');
  // Búsqueda reactiva de integrantes
  protected readonly memberQuery = signal('');
  // Confirmación en dos pasos para acciones destructivas
  protected readonly confirming = signal<{ id: number; action: MemberAction } | null>(null);

  protected readonly activeCount = computed(
    () => this.employees().filter((employee) => employee.active !== false).length,
  );

  protected readonly filteredMembers = computed(() => {
    const query = this.memberQuery().trim().toLowerCase();
    const list = this.employees();
    if (!query) return list;
    return list.filter((employee) =>
      `${employee.name ?? ''} ${employee.lastName ?? ''} ${employee.email ?? ''}`.toLowerCase().includes(query));
  });

  constructor() {
    effect(() => {
      if (this.successMessage()) {
        this.email.set('');
        this.emailError.set('');
        this.showForm.set(false);
        this.confirming.set(null);
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

  protected isActive(employee: EmployeeResponse): boolean {
    return employee.active !== false;
  }

  protected permissionChanged(employee: EmployeeResponse, checked: boolean): void {
    if (employee.employeeId == null || employee.owner) return;
    this.schedulePermission.emit({ employeeId: employee.employeeId, enabled: checked });
  }

  /** Primer clic arma la confirmación; el segundo emite la acción al padre. */
  protected requestConfirm(employee: EmployeeResponse, action: MemberAction): void {
    if (employee.employeeId == null) return;
    const current = this.confirming();
    if (current?.id === employee.employeeId && current.action === action) {
      this.confirming.set(null);
      if (action === 'deactivate') this.deactivateEmployee.emit(employee.employeeId);
      else this.deleteEmployee.emit(employee.employeeId);
      return;
    }
    this.confirming.set({ id: employee.employeeId, action });
  }

  protected cancelConfirm(): void {
    this.confirming.set(null);
  }

  protected isConfirming(employeeId: number | undefined, action: MemberAction): boolean {
    if (employeeId == null) return false;
    const current = this.confirming();
    return current?.id === employeeId && current.action === action;
  }
}

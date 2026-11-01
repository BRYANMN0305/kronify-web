import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InvitationResponse } from '../../../../core/api/openapi/model/invitationResponse';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';

const STATUS_META: Record<string, { readonly label: string; readonly cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'status-pending' },
  ACCEPTED: { label: 'Aceptada', cls: 'status-accepted' },
  CANCELLED: { label: 'Cancelada', cls: 'status-cancelled' },
  EXPIRED: { label: 'Expirada', cls: 'status-expired' },
};

/** Gestión presentacional de invitaciones; el padre ejecuta las operaciones del API. */
@Component({
  selector: 'app-team-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DateFmtPipe, Icon],
  templateUrl: './team-tab.html',
})
export class TeamTab {
  readonly invitations = input.required<readonly InvitationResponse[]>();
  readonly sending = input(false);
  readonly busyId = input<number | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);

  readonly createInvitation = output<string>();
  readonly resendInvitation = output<number>();
  readonly cancelInvitation = output<number>();

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
}

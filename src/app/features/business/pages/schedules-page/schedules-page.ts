import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BusinessControllerService } from '../../../../core/api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { OpeningHourRequest } from '../../../../core/api/openapi/model/openingHourRequest';
import type { OpeningHourResponse } from '../../../../core/api/openapi/model/openingHourResponse';
import type { ScheduleBlockResponse } from '../../../../core/api/openapi/model/scheduleBlockResponse';
import type { WeeklyScheduleRequest } from '../../../../core/api/openapi/model/weeklyScheduleRequest';
import type { WeeklyScheduleResponse } from '../../../../core/api/openapi/model/weeklyScheduleResponse';
import { Permissions } from '../../../../core/auth/permissions';
import { apiErrorMessage } from '../../../../core/auth/auth.store';
import { DatetimeService } from '../../../../core/datetime/datetime.service';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CLOSED = '00:00';

/**
 * Configura las horas públicas del negocio y la jornada semanal del equipo.
 * El dueño ve a todo el equipo; un empleado con autogestión solo ve su jornada
 * y sus bloqueos (GET /business/employees/me).
 */
@Component({
  selector: 'app-schedules-page', standalone: true, imports: [FormsModule],
  templateUrl: './schedules-page.html', styleUrl: './schedules-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulesPage implements OnInit {
  private readonly businessApi = inject(BusinessControllerService);
  private readonly employeeApi = inject(EmployeeControllerService);
  private readonly permissions = inject(Permissions);
  private readonly datetime = inject(DatetimeService);

  protected readonly days = DAYS;
  protected readonly isOwner = this.permissions.isOwner;
  protected readonly openingHours = signal<OpeningHourRequest[]>(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
  protected readonly employees = signal<readonly EmployeeResponse[]>([]);
  protected readonly employeeId = signal<number | null>(null);
  protected readonly existing = signal<readonly WeeklyScheduleResponse[]>([]);
  protected readonly employeeHours = signal<WeeklyScheduleRequest[]>(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  // ── Bloqueos puntuales del profesional ──────────────────────────────────
  protected readonly blocks = signal<readonly ScheduleBlockResponse[]>([]);
  protected readonly canEditSchedule = signal(true);
  protected readonly blockDate = signal(this.datetime.now().format('YYYY-MM-DD'));
  protected readonly blockStart = signal('09:00');
  protected readonly blockEnd = signal('10:00');
  protected readonly blockReason = signal('');
  protected readonly blockBusy = signal(false);
  protected readonly blockError = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.busy.set(true); this.error.set(null);
    const problems: string[] = [];

    if (this.permissions.isOwner()) {
      const [hoursResult, employeesResult] = await Promise.allSettled([
        firstValueFrom(this.businessApi.getOpeningHours()),
        firstValueFrom(this.employeeApi.listEmployees()),
      ]);
      if (hoursResult.status === 'fulfilled') this.openingHours.set(this.mapOpeningHours(hoursResult.value ?? []));
      else problems.push('No se pudo cargar el horario guardado del negocio.');
      if (employeesResult.status === 'fulfilled') {
        this.employees.set(employeesResult.value.filter((item) => item.active !== false && item.employeeId != null));
        const firstId = this.employees()[0]?.employeeId;
        if (firstId != null) await this.loadEmployeeData(firstId).catch(() => problems.push('No se pudo cargar la jornada guardada del profesional.'));
      } else problems.push('No se pudo cargar la lista de profesionales.');
    } else {
      try {
        const me = await firstValueFrom(this.employeeApi.getMyEmployee());
        if (me.employeeId != null) {
          this.employees.set([me]);
          if (me.selfManagedSchedule) {
            await this.loadEmployeeData(me.employeeId);
          } else {
            // Sin autogestión el backend no permite leer jornada ni bloqueos.
            this.employeeId.set(me.employeeId);
            this.canEditSchedule.set(false);
            this.employeeHours.set(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
            this.blocks.set([]);
          }
        }
      } catch {
        problems.push('No encontramos tu registro de empleado activo en este negocio.');
      }
    }

    this.error.set(problems.length ? problems.join(' ') : null);
    this.busy.set(false);
  }

  protected setOpening(index: number, field: 'startTime' | 'endTime', value: string): void {
    this.openingHours.update((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  protected setEmployeeHour(index: number, field: 'startTime' | 'endTime', value: string): void {
    this.employeeHours.update((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  protected async selectEmployee(id: number): Promise<void> {
    this.error.set(null); this.notice.set(null); this.busy.set(true);
    try { await this.loadEmployeeData(id); }
    catch { this.error.set('No se pudo cargar la jornada guardada del profesional.'); }
    finally { this.busy.set(false); }
  }

  protected async saveOpeningHours(): Promise<void> {
    const open = this.openingHours().filter((row) => row.startTime < row.endTime);
    await this.mutate(async () => {
      const saved = await firstValueFrom(this.businessApi.updateOpeningHours(open));
      this.openingHours.set(this.mapOpeningHours(saved ?? []));
      this.notice.set('Horario del negocio guardado en el servidor.');
    });
  }

  protected async saveEmployeeHours(): Promise<void> {
    const id = this.employeeId();
    if (id == null || !this.canEditSchedule()) return;
    const rows = this.employeeHours();
    await this.mutate(async () => {
      for (const saved of this.existing()) {
        const current = rows.find((row) => row.dayOfWeek === saved.dayOfWeek);
        if (current && current.startTime >= current.endTime && saved.weeklyScheduleId != null)
          await firstValueFrom(this.employeeApi.deleteWeeklySchedule(id, saved.weeklyScheduleId));
      }
      for (const row of rows) if (row.startTime < row.endTime) await firstValueFrom(this.employeeApi.upsertWeeklySchedule(id, row));
      await this.loadEmployeeData(id);
      this.notice.set('Jornada guardada en el servidor.');
    });
  }

  // ── Bloqueos ────────────────────────────────────────────────────────────
  protected setBlock(field: 'blockDate' | 'blockStart' | 'blockEnd' | 'blockReason', value: string): void {
    if (field === 'blockDate') this.blockDate.set(value);
    else if (field === 'blockStart') this.blockStart.set(value);
    else if (field === 'blockEnd') this.blockEnd.set(value);
    else this.blockReason.set(value);
  }

  protected async createBlock(): Promise<void> {
    const id = this.employeeId();
    if (id == null || !this.canEditSchedule()) return;
    const date = this.blockDate();
    const start = this.blockStart();
    const end = this.blockEnd();
    if (!date || !start || !end || start >= end) {
      this.blockError.set('Indica una fecha y un rango de horas válido (el inicio debe ser menor que el fin).');
      return;
    }
    this.blockBusy.set(true); this.blockError.set(null); this.notice.set(null);
    try {
      await firstValueFrom(this.employeeApi.createScheduleBlock(id, {
        startAt: `${date}T${start}:00`,
        endAt: `${date}T${end}:00`,
        reason: this.blockReason().trim() || undefined,
      }));
      await this.loadBlocks(id);
      this.blockReason.set('');
      this.notice.set('Bloqueo creado: ese horario ya no se ofrece en la reserva pública.');
    } catch (error) {
      this.blockError.set(apiErrorMessage(error) || 'No se pudo crear el bloqueo.');
    } finally {
      this.blockBusy.set(false);
    }
  }

  protected async deleteBlock(blockId?: number): Promise<void> {
    const id = this.employeeId();
    if (id == null || blockId == null || !this.canEditSchedule()) return;
    this.blockBusy.set(true); this.blockError.set(null); this.notice.set(null);
    try {
      await firstValueFrom(this.employeeApi.deleteScheduleBlock(id, blockId));
      await this.loadBlocks(id);
      this.notice.set('Bloqueo eliminado.');
    } catch (error) {
      this.blockError.set(apiErrorMessage(error) || 'No se pudo eliminar el bloqueo.');
    } finally {
      this.blockBusy.set(false);
    }
  }

  protected blockLabel(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async loadEmployeeData(id: number): Promise<void> {
    const [schedules, blocks] = await Promise.all([
      firstValueFrom(this.employeeApi.listWeeklySchedules(id)),
      firstValueFrom(this.employeeApi.listScheduleBlocks(id)),
    ]);
    this.employeeId.set(id);
    this.existing.set(schedules ?? []);
    this.employeeHours.set(DAYS.map((_, i) => {
      const dayOfWeek = i + 1;
      const saved = (schedules ?? []).find((item) => item.dayOfWeek === dayOfWeek);
      return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
    }));
    this.blocks.set(blocks ?? []);
    const employee = this.employees().find((item) => item.employeeId === id);
    this.canEditSchedule.set(this.permissions.isOwner() || employee?.selfManagedSchedule === true);
  }

  private async loadBlocks(id: number): Promise<void> {
    this.blocks.set((await firstValueFrom(this.employeeApi.listScheduleBlocks(id))) ?? []);
  }

  private mapOpeningHours(hours: readonly OpeningHourResponse[]): OpeningHourRequest[] {
    return DAYS.map((_, i) => {
      const dayOfWeek = i + 1;
      const saved = hours.find((item) => item.dayOfWeek === dayOfWeek);
      return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
    });
  }

  private async mutate(action: () => Promise<void>): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try { await action(); } catch (error) { this.error.set(apiErrorMessage(error) || 'No se pudo guardar el horario en el servidor. Revisa los intervalos e inténtalo de nuevo.'); }
    finally { this.busy.set(false); }
  }
}

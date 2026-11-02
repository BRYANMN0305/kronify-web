import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BusinessControllerService } from '../../../../core/api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { OpeningHourRequest } from '../../../../core/api/openapi/model/openingHourRequest';
import type { OpeningHourResponse } from '../../../../core/api/openapi/model/openingHourResponse';
import type { WeeklyScheduleRequest } from '../../../../core/api/openapi/model/weeklyScheduleRequest';
import type { WeeklyScheduleResponse } from '../../../../core/api/openapi/model/weeklyScheduleResponse';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CLOSED = '00:00';

/** Configura las horas públicas del negocio y la jornada semanal del equipo. */
@Component({
  selector: 'app-schedules-page', standalone: true, imports: [FormsModule],
  templateUrl: './schedules-page.html', styleUrl: './schedules-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulesPage implements OnInit {
  private readonly businessApi = inject(BusinessControllerService);
  private readonly employeeApi = inject(EmployeeControllerService);
  protected readonly days = DAYS;
  protected readonly openingHours = signal<OpeningHourRequest[]>(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
  protected readonly employees = signal<readonly EmployeeResponse[]>([]);
  protected readonly employeeId = signal<number | null>(null);
  protected readonly existing = signal<readonly WeeklyScheduleResponse[]>([]);
  protected readonly employeeHours = signal<WeeklyScheduleRequest[]>(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.busy.set(true); this.error.set(null);
    const [hoursResult, employeesResult] = await Promise.allSettled([
      firstValueFrom(this.businessApi.getOpeningHours()),
      firstValueFrom(this.employeeApi.listEmployees()),
    ]);
    const problems: string[] = [];
    if (hoursResult.status === 'fulfilled') this.openingHours.set(this.mapOpeningHours(hoursResult.value ?? []));
    else problems.push('No se pudo cargar el horario guardado del negocio.');
    if (employeesResult.status === 'fulfilled') {
      this.employees.set(employeesResult.value.filter((item) => item.active !== false && item.employeeId != null));
      const firstId = this.employees()[0]?.employeeId;
      if (firstId != null) await this.loadEmployeeHours(firstId).catch(() => problems.push('No se pudo cargar la jornada guardada del profesional.'));
    } else problems.push('No se pudo cargar la lista de profesionales.');
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
    this.error.set(null); this.busy.set(true);
    try { await this.loadEmployeeHours(id); }
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
    if (id == null) return;
    const rows = this.employeeHours();
    await this.mutate(async () => {
      for (const saved of this.existing()) {
        const current = rows.find((row) => row.dayOfWeek === saved.dayOfWeek);
        if (current && current.startTime >= current.endTime && saved.weeklyScheduleId != null)
          await firstValueFrom(this.employeeApi.deleteWeeklySchedule(id, saved.weeklyScheduleId));
      }
      for (const row of rows) if (row.startTime < row.endTime) await firstValueFrom(this.employeeApi.upsertWeeklySchedule(id, row));
      await this.loadEmployeeHours(id);
      this.notice.set('Jornada guardada en el servidor.');
    });
  }

  private async loadEmployeeHours(id: number): Promise<void> {
    const schedules = await firstValueFrom(this.employeeApi.listWeeklySchedules(id));
    this.employeeId.set(id);
    this.existing.set(schedules ?? []);
    this.employeeHours.set(DAYS.map((_, i) => {
      const dayOfWeek = i + 1;
      const saved = schedules.find((item) => item.dayOfWeek === dayOfWeek);
      return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
    }));
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
    try { await action(); } catch { this.error.set('No se pudo guardar el horario en el servidor. Revisa los intervalos e inténtalo de nuevo.'); }
    finally { this.busy.set(false); }
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BusinessControllerService } from '../../../../core/api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { OpeningHourRequest } from '../../../../core/api/openapi/model/openingHourRequest';
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
    const [hours, employees] = await Promise.all([
      firstValueFrom(this.businessApi.getOpeningHours()).catch(() => []),
      firstValueFrom(this.employeeApi.listEmployees()).catch(() => []),
    ]);
    this.openingHours.set(DAYS.map((_, i) => {
      const dayOfWeek = i + 1;
      const saved = hours.find((item) => item.dayOfWeek === dayOfWeek);
      return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
    }));
    this.employees.set(employees.filter((item) => item.active !== false && item.employeeId != null));
    const firstId = this.employees()[0]?.employeeId;
    if (firstId != null) await this.selectEmployee(firstId);
    this.busy.set(false);
  }
  protected setOpening(index: number, field: 'startTime' | 'endTime', value: string): void {
    this.openingHours.update((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  protected setEmployeeHour(index: number, field: 'startTime' | 'endTime', value: string): void {
    this.employeeHours.update((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  protected async selectEmployee(id: number): Promise<void> {
    this.employeeId.set(id);
    try {
      const schedules = await firstValueFrom(this.employeeApi.listWeeklySchedules(id));
      this.existing.set(schedules ?? []);
      this.employeeHours.set(DAYS.map((_, i) => {
        const dayOfWeek = i + 1;
        const saved = schedules.find((item) => item.dayOfWeek === dayOfWeek);
        return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
      }));
    } catch { this.error.set('No se pudo cargar el horario del profesional.'); }
  }
  protected async saveOpeningHours(): Promise<void> {
    const open = this.openingHours().filter((row) => row.startTime < row.endTime);
    await this.mutate(async () => { await firstValueFrom(this.businessApi.updateOpeningHours(open)); this.notice.set('Horario del negocio guardado.'); });
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
      await this.selectEmployee(id);
      this.notice.set('Horario del profesional guardado.');
    });
  }
  private async mutate(action: () => Promise<void>): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try { await action(); } catch { this.error.set('No se pudo guardar el horario. Revisa los intervalos e inténtalo de nuevo.'); }
    finally { this.busy.set(false); }
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BusinessControllerService } from '../../../../core/api/openapi/api/businessController.service';
import { EmployeeControllerService } from '../../../../core/api/openapi/api/employeeController.service';
import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { EmployeeResponse } from '../../../../core/api/openapi/model/employeeResponse';
import type { OpeningHourRequest } from '../../../../core/api/openapi/model/openingHourRequest';
import type { OpeningHourResponse } from '../../../../core/api/openapi/model/openingHourResponse';
import type { ScheduleBlockResponse } from '../../../../core/api/openapi/model/scheduleBlockResponse';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';
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
  private readonly servicesApi = inject(ServiceControllerService);
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

  // ── Servicios vinculados al profesional ─────────────────────────────────
  protected readonly activeTab = signal<'weekly' | 'blocks' | 'services'>('weekly');
  protected readonly catalog = signal<readonly ServiceResponse[]>([]);
  protected readonly catalogLoaded = signal(false);
  protected readonly assignedServiceIds = signal<readonly number[]>([]);
  protected readonly selectedServiceIds = signal<readonly number[]>([]);
  protected readonly servicesBusy = signal(false);
  protected readonly servicesError = signal<string | null>(null);

  // ── Búsqueda reactiva ───────────────────────────────────────────────────
  protected readonly employeeQuery = signal('');
  protected readonly serviceQuery = signal('');

  // ── Validación en vivo del formulario de bloqueos ───────────────────────
  protected readonly blockErrors = computed<string[]>(() => {
    const errors: string[] = [];
    const date = this.blockDate();
    const start = this.blockStart();
    const end = this.blockEnd();
    if (!date) errors.push('Selecciona la fecha del bloqueo.');
    if (!start || !end) {
      errors.push('Indica la hora de inicio y de fin.');
    } else if (start >= end) {
      errors.push('La hora de inicio debe ser anterior a la de fin.');
    }
    if (date && date < this.datetime.now().format('YYYY-MM-DD')) {
      errors.push('La fecha no puede ser anterior a hoy.');
    }
    return errors;
  });
  protected readonly blockDateInvalid = computed(() => {
    const date = this.blockDate();
    return !date || date < this.datetime.now().format('YYYY-MM-DD');
  });
  protected readonly blockTimeInvalid = computed(() => {
    const start = this.blockStart();
    const end = this.blockEnd();
    return !start || !end || start >= end;
  });

  protected readonly filteredEmployees = computed(() => {
    const query = this.employeeQuery().trim().toLowerCase();
    const list = this.employees();
    if (!query) return list;
    return list.filter((employee) =>
      `${employee.name ?? ''} ${employee.lastName ?? ''} ${employee.email ?? ''}`.toLowerCase().includes(query));
  });

  protected readonly filteredServices = computed(() => {
    const query = this.serviceQuery().trim().toLowerCase();
    const list = this.catalog().filter((service) => service.active !== false && service.id != null);
    if (!query) return list;
    return list.filter((service) => (service.name ?? '').toLowerCase().includes(query));
  });

  protected readonly pendingServiceChanges = computed(() => {
    const wanted = new Set(this.selectedServiceIds());
    const current = new Set(this.assignedServiceIds());
    return {
      adds: [...wanted].filter((id) => !current.has(id)),
      removes: [...current].filter((id) => !wanted.has(id)),
    };
  });
  protected readonly hasServiceChanges = computed(() => {
    const { adds, removes } = this.pendingServiceChanges();
    return adds.length > 0 || removes.length > 0;
  });
  protected readonly pendingChangesLabel = computed(() => {
    const { adds, removes } = this.pendingServiceChanges();
    if (adds.length === 0 && removes.length === 0) return 'Todo sincronizado con el servidor.';
    const parts: string[] = [];
    if (adds.length > 0) parts.push(`${adds.length} por asignar`);
    if (removes.length > 0) parts.push(`${removes.length} por quitar`);
    return `${parts.join(' · ')} — cambios sin guardar`;
  });

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
      // Se separa "no es empleado" de "falló la carga de su jornada": antes un
      // fallo del endpoint de servicios mostraba el mensaje de empleado inexistente.
      let me: EmployeeResponse | null = null;
      try {
        me = await firstValueFrom(this.employeeApi.getMyEmployee());
      } catch {
        problems.push('No encontramos tu registro de empleado activo en este negocio.');
      }

      if (me?.employeeId != null) {
        this.employees.set([me]);
        this.employeeId.set(me.employeeId);
        if (me.selfManagedSchedule) {
          try {
            await this.loadEmployeeData(me.employeeId);
          } catch {
            // Sin datos no se permite editar para no guardar una jornada incompleta.
            this.canEditSchedule.set(false);
            problems.push('No se pudo cargar tu jornada guardada. Inténtalo de nuevo en unos segundos.');
          }
        } else {
          // Sin autogestión el backend no permite leer jornada ni bloqueos.
          this.canEditSchedule.set(false);
          this.employeeHours.set(DAYS.map((_, i) => ({ dayOfWeek: i + 1, startTime: CLOSED, endTime: CLOSED })));
          this.blocks.set([]);
        }
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
    this.error.set(null); this.notice.set(null); this.servicesError.set(null); this.busy.set(true);
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
    if (id == null || !this.canEditSchedule() || this.blockErrors().length > 0) return;
    const date = this.blockDate();
    const start = this.blockStart();
    const end = this.blockEnd();
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

  // ── Pestañas y servicios del profesional ────────────────────────────────
  protected openTab(tab: 'weekly' | 'blocks' | 'services'): void {
    this.activeTab.set(tab);
    if (tab === 'services' && !this.catalogLoaded() && !this.servicesBusy()) {
      void this.loadCatalog();
    }
  }

  protected isSelected(serviceId?: number): boolean {
    return serviceId != null && this.selectedServiceIds().includes(serviceId);
  }

  protected toggleService(serviceId: number | undefined, checked: boolean): void {
    if (serviceId == null) return;
    this.selectedServiceIds.update((ids) =>
      checked ? [...ids, serviceId] : ids.filter((id) => id !== serviceId));
  }

  protected async saveServices(): Promise<void> {
    const id = this.employeeId();
    if (id == null || !this.permissions.isOwner()) return;
    const { adds, removes } = this.pendingServiceChanges();
    if (adds.length === 0 && removes.length === 0) return;
    this.servicesBusy.set(true); this.servicesError.set(null); this.notice.set(null);
    try {
      // El backend agrega los ids enviados y conserva los existentes; las
      // bajas van una a una por el endpoint dedicado.
      if (adds.length > 0) await firstValueFrom(this.employeeApi.updateEmployeeServices(id, { serviceIds: adds }));
      for (const serviceId of removes) await firstValueFrom(this.employeeApi.removeServiceFromEmployee(id, serviceId));
      const services = (await firstValueFrom(this.employeeApi.listEmployeeServices(id))) ?? [];
      this.setAssignedServices(services);
      this.notice.set('Servicios del profesional actualizados.');
    } catch (error) {
      this.servicesError.set(apiErrorMessage(error) || 'No se pudieron guardar los servicios.');
    } finally {
      this.servicesBusy.set(false);
    }
  }

  protected serviceMeta(service: ServiceResponse): string {
    const parts: string[] = [];
    if (service.durationMinutes != null) parts.push(`${service.durationMinutes} min`);
    if (service.price != null) {
      parts.push(new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(service.price));
    }
    return parts.join(' · ') || '—';
  }

  protected employeeInitials(employee: EmployeeResponse): string {
    const first = employee.name?.trim()[0] ?? '';
    const last = employee.lastName?.trim()[0] ?? '';
    return (first + last).toUpperCase() || 'E';
  }

  protected blockLabel(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async loadEmployeeData(id: number): Promise<void> {
    // Fija el profesional antes de consultar para que la vista no muestre
    // "Selecciona un profesional" mientras llegan sus datos.
    this.employeeId.set(id);
    const [schedules, blocks] = await Promise.all([
      firstValueFrom(this.employeeApi.listWeeklySchedules(id)),
      firstValueFrom(this.employeeApi.listScheduleBlocks(id)),
    ]);
    // GET .../services está restringido al dueño; un empleado autogestionado
    // solo necesita su jornada y sus bloqueos, así que se omite.
    const services = this.permissions.isOwner()
      ? await firstValueFrom(this.employeeApi.listEmployeeServices(id))
      : [];
    this.existing.set(schedules ?? []);
    this.employeeHours.set(DAYS.map((_, i) => {
      const dayOfWeek = i + 1;
      const saved = (schedules ?? []).find((item) => item.dayOfWeek === dayOfWeek);
      return { dayOfWeek, startTime: saved?.startTime ?? CLOSED, endTime: saved?.endTime ?? CLOSED };
    }));
    this.blocks.set(this.sortBlocks(blocks ?? []));
    this.setAssignedServices(services ?? []);
    const employee = this.employees().find((item) => item.employeeId === id);
    this.canEditSchedule.set(this.permissions.isOwner() || employee?.selfManagedSchedule === true);
  }

  private async loadBlocks(id: number): Promise<void> {
    const blocks = (await firstValueFrom(this.employeeApi.listScheduleBlocks(id))) ?? [];
    this.blocks.set(this.sortBlocks(blocks));
  }

  /** Bloqueos ordenados por fecha de inicio ascendente (los próximos primero). */
  private sortBlocks(blocks: readonly ScheduleBlockResponse[]): readonly ScheduleBlockResponse[] {
    return blocks.slice().sort((left, right) => (left.startAt ?? '').localeCompare(right.startAt ?? ''));
  }

  private setAssignedServices(services: readonly ServiceResponse[]): void {
    const ids = services.map((service) => service.id).filter((id): id is number => id != null);
    this.assignedServiceIds.set(ids);
    this.selectedServiceIds.set([...ids]);
  }

  /** Catálogo del negocio para la pestaña de servicios (se pide una sola vez). */
  private async loadCatalog(): Promise<void> {
    this.servicesBusy.set(true);
    this.servicesError.set(null);
    try {
      this.catalog.set((await firstValueFrom(this.servicesApi.listServices())) ?? []);
      this.catalogLoaded.set(true);
    } catch {
      this.servicesError.set('No se pudo cargar el catálogo de servicios. Vuelve a abrir la pestaña para reintentar.');
    } finally {
      this.servicesBusy.set(false);
    }
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

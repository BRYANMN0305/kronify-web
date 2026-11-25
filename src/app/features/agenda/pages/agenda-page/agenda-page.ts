import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, NgZone, OnDestroy, OnInit, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import type { Dayjs } from 'dayjs';
import { BASE_PATH } from '../../../../core/api/openapi/variables';
import type { AppointmentResponse } from '../../../../core/api/openapi/model/appointmentResponse';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Permissions } from '../../../../core/auth/permissions';
import { DatetimeService } from '../../../../core/datetime/datetime.service';
import { AgendaStore } from '../../data/agenda.store';
import type { AgendaFilterStatus } from '../../data/agenda.store';
import type { Appointment, AppointmentStatus } from '../../modelos/appointment.model';
import { AgendaSummary } from '../../ui/agenda-summary';
import { AppointmentStatusClassPipe } from '../../ui/appointment-status.pipe';
import { CalendarGrid } from '../../ui/calendar-grid';
import type { CalendarDay } from '../../ui/calendar-grid';
import { RescheduleDialog } from '../../ui/reschedule-dialog';
import { AppointmentDetailDialog } from '../../ui/appointment-detail-dialog';
import { CreateAppointmentDialog } from '../create-appointment-page/create-appointment-page';
import { PUBLIC_APPOINTMENT_CREATED_KEY, readPublicAppointmentCreatedEvent } from '../../../../core/events/public-appointment-created';

// La agenda siempre presenta fechas y moneda con convenciones colombianas.
registerLocaleData(localeEsCo);

interface StatusOption { readonly value: AgendaFilterStatus; readonly label: string; }

/** Vista del calendario: día (timeline), semana (cuadrícula de tiempo) o mes. */
type AgendaView = 'day' | 'week' | 'month';

/** Columna del calendario semanal, con sus citas ya agrupadas. */
interface WeekColumn {
  readonly date: Dayjs;
  readonly key: string;
  readonly name: string;
  readonly dayNumber: number;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly appointments: readonly Appointment[];
}

/** Bloque de cita posicionado dentro de la cuadrícula semanal de tiempo. */
interface WeekBlock {
  readonly appointment: Appointment;
  readonly topPx: number;
  readonly heightPx: number;
  readonly compact: boolean;
  readonly tiny: boolean;
  readonly leftStyle: string;
  readonly widthStyle: string;
}

const ES_CO = 'es-CO';
/** Ventana horaria que el timeline del día muestra por defecto (7:00 a 20:00). */
const DAY_FIRST_HOUR = 7;
const DAY_LAST_HOUR = 20;
/** Altura en píxeles de cada hora en la cuadrícula semanal (sincronizada con el CSS). */
const WEEK_HOUR_PX = 48;
/** Altura mínima de un bloque de cita en la semana, para que siempre sea visible. */
const WEEK_BLOCK_MIN_PX = 22;

/** Mayúscula inicial; Intl devuelve los nombres de días y meses en minúscula con es-CO. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Minutos desde la medianoche de un campo "HH:mm". */
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

/** Hora de inicio de una cita a partir de su campo "HH:mm". */
function hourOf(time: string): number {
  return Number.parseInt(time.slice(0, 2), 10);
}

/** Minuto de finalización: endTime declarado o hora de inicio + duración del servicio. */
function endMinutesOf(appointment: Appointment): number {
  const start = minutesOf(appointment.time);
  if (appointment.endTime) return Math.max(start, minutesOf(appointment.endTime));
  const duration = appointment.durationMinutes > 0 ? appointment.durationMinutes : 45;
  return start + duration;
}

/**
 * Calendario operativo de la agenda del negocio. La vista por defecto es el MES;
 * también están la SEMANA (cuadrícula de tiempo con 7 columnas) y el DÍA (timeline
 * por horas). Todo sale del API real: rango visible + actualizaciones por SSE.
 */
@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [CurrencyPipe, AgendaSummary, AppointmentStatusClassPipe, CalendarGrid, CreateAppointmentDialog, RescheduleDialog, AppointmentDetailDialog],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage implements OnInit, OnDestroy {
  protected readonly store = inject(AgendaStore);
  private readonly datetime = inject(DatetimeService);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(Permissions);
  private readonly zone = inject(NgZone);
  private readonly basePath = inject(BASE_PATH);

  /** Solo el dueño puede consultar la agenda de todo el equipo. */
  protected readonly isOwner = this.permissions.isOwner;
  protected readonly appointments = this.store.appointments;
  protected readonly loading = this.store.loading;
  protected readonly storeError = this.store.error;

  /** Vista activa; el mes es la predeterminada. */
  protected readonly view = signal<AgendaView>('month');
  /** Ancla temporal: en vista día es el día mostrado; en semana define la semana. */
  protected readonly viewDate = signal(this.datetime.now().startOf('day'));
  protected readonly todayKey = this.datetime.now().format('YYYY-MM-DD');
  protected readonly createDialogOpen = signal(false);
  protected readonly rescheduling = signal<Appointment | null>(null);
  protected readonly selectedAppointment = signal<Appointment | null>(null);
  protected readonly statusOptions: readonly StatusOption[] = [
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'CONFIRMED', label: 'Confirmadas' },
    { value: 'COMPLETED', label: 'Completadas' },
    { value: 'CANCELLED', label: 'Canceladas' },
    { value: 'NO_SHOW', label: 'No asistió' },
  ];

  // ── Rango visible según la vista ──────────────────────────────────────────
  /** Lunes de la semana del ancla (la semana siempre inicia el lunes). */
  private readonly weekStart = computed(() => {
    const date = this.viewDate();
    return date.subtract((date.day() + 6) % 7, 'day');
  });
  private readonly visibleStart = computed(() => {
    switch (this.view()) {
      case 'day': return this.viewDate();
      case 'week': return this.weekStart();
      case 'month': return this.viewDate().startOf('month');
    }
  });
  private readonly visibleEnd = computed(() => {
    switch (this.view()) {
      case 'day': return this.viewDate();
      case 'week': return this.weekStart().add(6, 'day');
      case 'month': return this.viewDate().endOf('month');
    }
  });

  /** Título del periodo visible; Intl nativo en español colombiano. */
  protected readonly periodTitle = computed(() => {
    if (this.view() === 'month') {
      return capitalize(new Intl.DateTimeFormat(ES_CO, { month: 'long', year: 'numeric' })
        .format(this.viewDate().toDate()));
    }
    if (this.view() === 'day') {
      const formatted = new Intl.DateTimeFormat(ES_CO, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(this.viewDate().toDate());
      return capitalize(formatted);
    }
    const start = this.weekStart();
    const end = start.add(6, 'day');
    const monthFormatter = new Intl.DateTimeFormat(ES_CO, { month: 'long' });
    const startMonth = capitalize(monthFormatter.format(start.toDate()));
    const endMonth = capitalize(monthFormatter.format(end.toDate()));
    if (start.month() === end.month() && start.year() === end.year()) {
      return `${start.date()} – ${end.date()} de ${endMonth} de ${end.year()}`;
    }
    if (start.year() === end.year()) {
      return `${start.date()} de ${startMonth} – ${end.date()} de ${endMonth} de ${end.year()}`;
    }
    return `${start.date()} de ${startMonth} de ${start.year()} – ${end.date()} de ${endMonth} de ${end.year()}`;
  });

  /** Etiqueta de la primera tarjeta del resumen, según la vista activa. */
  protected readonly summaryPeriod = computed(() => {
    switch (this.view()) {
      case 'day': return 'CITAS DEL DÍA';
      case 'week': return 'CITAS DE LA SEMANA';
      case 'month': return 'CITAS DEL MES';
    }
  });

  /** El periodo visible contiene hoy: oculta el botón "Hoy". */
  protected readonly isViewingToday = computed(() => {
    const start = this.visibleStart().format('YYYY-MM-DD');
    const end = this.visibleEnd().format('YYYY-MM-DD');
    return this.todayKey >= start && this.todayKey <= end;
  });

  // ── Datos derivados del rango cargado ─────────────────────────────────────
  /** Citas indexadas por día ("YYYY-MM-DD") para la timeline y las columnas. */
  private readonly appointmentsByKey = computed(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of this.appointments()) {
      const key = appointment.dateKey ?? this.todayKey;
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  });

  protected readonly viewDateKey = computed(() => this.viewDate().format('YYYY-MM-DD'));
  protected readonly dayAppointments = computed(() => this.appointmentsByKey().get(this.viewDateKey()) ?? []);

  /** Horas del timeline: 7:00–20:00 más cualquier hora con citas fuera de esa ventana. */
  protected readonly dayHours = computed<readonly number[]>(() => {
    const hours = new Set<number>();
    for (let hour = DAY_FIRST_HOUR; hour <= DAY_LAST_HOUR; hour += 1) hours.add(hour);
    for (const appointment of this.dayAppointments()) {
      const hour = hourOf(appointment.time);
      if (Number.isFinite(hour)) hours.add(hour);
    }
    return [...hours].sort((left, right) => left - right);
  });

  /** Las 7 columnas de la semana con sus citas agrupadas. */
  protected readonly weekColumns = computed<readonly WeekColumn[]>(() => {
    const start = this.weekStart();
    const map = this.appointmentsByKey();
    const nameFormatter = new Intl.DateTimeFormat(ES_CO, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) => {
      const date = start.add(index, 'day');
      const key = date.format('YYYY-MM-DD');
      return {
        date,
        key,
        name: capitalize(nameFormatter.format(date.toDate()).slice(0, 3)),
        dayNumber: date.date(),
        isToday: key === this.todayKey,
        isWeekend: date.day() === 0 || date.day() === 6,
        appointments: map.get(key) ?? [],
      };
    });
  });

  /** Semanas de la cuadrícula mensual (6 filas desde el lunes de la primera semana). */
  protected readonly monthWeeks = computed<readonly (readonly CalendarDay[])[]>(() => {
    const monthStart = this.viewDate().startOf('month');
    const gridStart = monthStart.subtract((monthStart.day() + 6) % 7, 'day');
    const map = this.appointmentsByKey();
    return Array.from({ length: 6 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = gridStart.add(weekIndex * 7 + dayIndex, 'day');
        const key = date.format('YYYY-MM-DD');
        return {
          date: date.toDate(),
          key,
          dayNumber: date.date(),
          belongsToMonth: date.month() === monthStart.month(),
          isToday: key === this.todayKey,
          appointments: map.get(key) ?? [],
        };
      }),
    );
  });

  /** Horas de la semana: 7:00–20:00 más cualquier hora con citas fuera de esa ventana. */
  protected readonly weekHours = computed<readonly number[]>(() => {
    const hours = new Set<number>();
    for (let hour = DAY_FIRST_HOUR; hour <= DAY_LAST_HOUR; hour += 1) hours.add(hour);
    for (const column of this.weekColumns()) {
      for (const appointment of column.appointments) {
        const hour = hourOf(appointment.time);
        if (Number.isFinite(hour)) hours.add(hour);
      }
    }
    return [...hours].sort((left, right) => left - right);
  });

  /** Altura del lienzo semanal (px); una franja fija por cada hora visible. */
  protected readonly weekCanvasHeight = computed(() => this.weekHours().length * WEEK_HOUR_PX);

  private eventSource: EventSource | null = null;
  private streamErrors = 0;

  @ViewChild('weekScroll') private weekScroll?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    void this.store.loadFilterOptions();
    this.loadVisibleRange();
    this.connectStream();
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  @HostListener('window:storage', ['$event'])
  protected onPublicAppointmentStored(event: StorageEvent): void {
    if (event.key !== PUBLIC_APPOINTMENT_CREATED_KEY) return;
    const payload = readPublicAppointmentCreatedEvent(event.newValue);
    if (!payload?.startAt) { this.loadVisibleRange(); return; }
    // Cita creada desde la reserva pública: se abre el timeline de su día.
    this.viewDate.set(this.datetime.fromLocal(payload.startAt).startOf('day'));
    this.view.set('day');
    this.loadVisibleRange();
  }

  @HostListener('window:focus')
  protected refreshWhenReturningToCalendar(): void {
    // Si el stream se cortó por fallos repetidos (p. ej. sesión vencida), se reintenta:
    // si el token ya no sirve, la recarga HTTP de abajo manda al login.
    if (!this.eventSource) this.connectStream();
    this.loadVisibleRange();
  }

  // ── Navegación de la vista ────────────────────────────────────────────────
  protected setView(view: AgendaView): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.loadVisibleRange();
    if (view === 'week') this.scrollWeekToWindowStart();
  }

  protected previousPeriod(): void {
    const view = this.view();
    this.viewDate.update((date) => view === 'month'
      ? date.startOf('month').subtract(1, 'month')
      : date.subtract(view === 'day' ? 1 : 7, 'day'));
    this.loadVisibleRange();
  }

  protected nextPeriod(): void {
    const view = this.view();
    this.viewDate.update((date) => view === 'month'
      ? date.startOf('month').add(1, 'month')
      : date.add(view === 'day' ? 1 : 7, 'day'));
    this.loadVisibleRange();
  }

  protected goToday(): void {
    if (this.isViewingToday()) return;
    this.viewDate.set(this.datetime.now().startOf('day'));
    this.loadVisibleRange();
    if (this.view() === 'week') this.scrollWeekToWindowStart();
  }

  /** Desde la vista semanal, abrir la línea de tiempo del día de una columna. */
  protected openDay(date: Dayjs): void {
    this.viewDate.set(date.startOf('day'));
    this.view.set('day');
    this.loadVisibleRange();
  }

  /** Desde la cuadrícula mensual, abrir la línea de tiempo del día elegido. */
  protected openDayFromGrid(date: Date): void {
    this.viewDate.set(this.datetime.at(date.getFullYear(), date.getMonth(), date.getDate()).startOf('day'));
    this.view.set('day');
    this.loadVisibleRange();
  }

  // ── Línea de tiempo del día ───────────────────────────────────────────────
  protected appointmentsAtHour(hour: number): readonly Appointment[] {
    return this.dayAppointments().filter((appointment) => hourOf(appointment.time) === hour);
  }

  protected hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  protected isCurrentHour(hour: number): boolean {
    return this.todayKey === this.viewDateKey() && this.datetime.now().hour() === hour;
  }

  protected appointmentInitials(appointment: Appointment): string {
    return appointment.client.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }

  protected phoneLabel(appointment: Appointment): string | null {
    const raw = appointment.phone?.replace(/\D/g, '');
    if (!raw) return null;
    if (raw.length === 10 && raw.startsWith('3')) {
      return `+57 ${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
    }
    return raw.length > 10 ? `+${raw}` : raw;
  }

  protected canManage(appointment: Appointment): boolean {
    return appointment.status === 'Pendiente' || appointment.status === 'Confirmada';
  }

  /** Acción principal de la cita: pendiente futura → confirmar; ya pasada → completar. */
  protected advanceLabel(appointment: Appointment): string | null {
    switch (appointment.status) {
      case 'Pendiente':
        // Nunca se ofrece confirmar una cita cuya hora de inicio ya pasó;
        // en su lugar se registra la asistencia real.
        return this.datetime.hasPassed(appointment.startAt) ? 'Completar' : 'Confirmar';
      case 'Confirmada': return 'Completar';
      default: return null;
    }
  }

  protected advance(appointment: Appointment): void {
    const status = appointment.status === 'Pendiente' && !this.datetime.hasPassed(appointment.startAt)
      ? 'Confirmada'
      : 'Completada';
    void this.store.updateStatus(appointment.id, status);
  }

  protected openAppointment(appointment: Appointment): void { this.selectedAppointment.set(appointment); }
  protected closeAppointment(): void { this.selectedAppointment.set(null); }
  protected updateSelectedAppointment(status: AppointmentStatus): void {
    const appointment = this.selectedAppointment();
    if (!appointment) return;
    // El detalle se mantiene abierto si la operación no se aplicó, para que el
    // usuario vea el motivo (por ejemplo, una cita que ya pasó) sin perder contexto.
    void this.store.updateStatus(appointment.id, status).then((updated) => {
      if (updated) this.closeAppointment();
    });
  }

  // ── Cuadrícula semanal de tiempo ──────────────────────────────────────────
  /**
   * Bloques de un día de la semana, posicionados por hora y duración. Las citas
   * que se cruzan se reparten en carriles laterales (ancho dividido) para que
   * todas queden legibles, como en un calendario de escritorio clásico.
   */
  protected blocksForDay(key: string): readonly WeekBlock[] {
    const items = this.appointmentsByKey().get(key) ?? [];
    if (items.length === 0) return [];
    const canvas = this.weekCanvasHeight();
    const hours = this.weekHours();
    const startMin = hours[0] * 60;
    const totalMin = hours.length * 60;
    const topPxOf = (minutes: number): number =>
      Math.max(0, Math.min(canvas, ((minutes - startMin) / totalMin) * canvas));

    const timed = items
      .map((appointment) => ({
        appointment,
        start: minutesOf(appointment.time),
        end: Math.max(endMinutesOf(appointment), minutesOf(appointment.time) + 15),
      }))
      .sort((left, right) => left.start - right.start || right.end - left.end);

    const blocks: WeekBlock[] = [];
    let cluster: { appointment: Appointment; start: number; end: number }[] = [];
    let clusterEnd = Number.NEGATIVE_INFINITY;
    const flushCluster = (): void => {
      if (cluster.length === 0) return;
      const laneEnds: number[] = [];
      const placed: { appointment: Appointment; start: number; end: number; lane: number }[] = [];
      for (const item of cluster) {
        let lane = laneEnds.findIndex((end) => end <= item.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(item.end);
        } else {
          laneEnds[lane] = item.end;
        }
        placed.push({ ...item, lane });
      }
      const laneCount = laneEnds.length;
      for (const item of placed) {
        const top = topPxOf(item.start);
        const height = Math.max(WEEK_BLOCK_MIN_PX, Math.min(canvas, topPxOf(item.end)) - top);
        const laneWidth = 100 / laneCount;
        blocks.push({
          appointment: item.appointment,
          topPx: top,
          heightPx: height,
          compact: height < 64,
          tiny: height < 40,
          leftStyle: `calc(${item.lane * laneWidth}% + 1px)`,
          widthStyle: `calc(${laneWidth}% - 3px)`,
        });
      }
      cluster = [];
      clusterEnd = Number.NEGATIVE_INFINITY;
    };
    for (const item of timed) {
      if (cluster.length > 0 && item.start >= clusterEnd) flushCluster();
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    }
    flushCluster();
    return blocks;
  }

  /** Posición vertical de la hora actual dentro del lienzo semanal. */
  protected nowPx(): number {
    const hours = this.weekHours();
    if (hours.length === 0) return 0;
    const now = this.datetime.now();
    const minutes = now.hour() * 60 + now.minute() - hours[0] * 60;
    const clamped = Math.max(0, Math.min(hours.length * 60, minutes));
    return (clamped / 60) * WEEK_HOUR_PX;
  }

  protected nowLabel(): string {
    return this.datetime.now().format('HH:mm');
  }

  /** Rango visible de una cita ("11:00 – 11:30"), como en Google Calendar. */
  protected eventRange(appointment: Appointment): string {
    const end = endMinutesOf(appointment);
    const hours = String(Math.floor(end / 60) % 24).padStart(2, '0');
    const minutes = String(end % 60).padStart(2, '0');
    return `${appointment.time} – ${hours}:${minutes}`;
  }

  // ── Diálogos y acciones sobre las citas ───────────────────────────────────
  protected openCreateDialog(): void { this.createDialogOpen.set(true); }
  protected closeCreateDialog(): void { this.createDialogOpen.set(false); }
  protected appointmentCreated(): void { this.createDialogOpen.set(false); this.loadVisibleRange(); }

  protected advanceStatus(id: number, status: AppointmentStatus): void {
    void this.store.updateStatus(id, status);
  }

  protected openReschedule(appointment: Appointment): void { this.selectedAppointment.set(null); this.rescheduling.set(appointment); }
  protected closeReschedule(): void { this.rescheduling.set(null); }
  protected appointmentRescheduled(): void { this.rescheduling.set(null); this.loadVisibleRange(); }

  // ── Filtros ───────────────────────────────────────────────────────────────
  protected filterByEmployee(value: string): void {
    this.store.setFilters({ employeeId: value ? Number(value) : null });
  }
  protected filterByService(value: string): void {
    this.store.setFilters({ serviceId: value ? Number(value) : null });
  }
  protected filterByStatus(value: string): void {
    this.store.setFilters({ status: value ? value as AgendaFilterStatus : null });
  }
  protected clearFilters(): void {
    this.store.clearFilters();
  }

  /** SSE del negocio: inserta las citas nuevas sin recargar el rango completo. */
  private connectStream(): void {
    const token = this.auth.token();
    if (!token || typeof EventSource === 'undefined') return;
    const base = Array.isArray(this.basePath) ? this.basePath[0] : this.basePath;
    this.streamErrors = 0;
    this.eventSource?.close();
    this.eventSource = new EventSource(`${base}/business/appointments/stream?token=${encodeURIComponent(token)}`);
    this.eventSource.addEventListener('appointment.created', (event) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse((event as MessageEvent).data as string) as AppointmentResponse;
          if (payload?.appointmentId != null) this.store.ingest(payload);
        } catch {
          // Un evento mal formado no debe tumbar el calendario.
        }
      });
    });
    this.eventSource.onopen = () => { this.streamErrors = 0; };
    this.eventSource.onerror = () => {
      // EventSource reconecta solo, pero con el token vencido reintenta cada pocos
      // segundos para siempre. Tras varios fallos seguidos se corta el bucle; la
      // siguiente petición HTTP decidirá si la sesión sigue siendo válida.
      this.streamErrors += 1;
      if (this.streamErrors >= 5) {
        this.eventSource?.close();
        this.eventSource = null;
      }
    };
  }

  /** Carga el rango que cubre la vista activa (el día mostrado o su semana). */
  private loadVisibleRange(): void {
    // AppointmentController binds both query params as LocalDate (YYYY-MM-DD).
    // Its range is inclusive.
    void this.store.loadRange(this.visibleStart().format('YYYY-MM-DD'), this.visibleEnd().format('YYYY-MM-DD'));
  }

  /** Al entrar a la semana, deja a la vista la franja actual (o el inicio de la ventana). */
  private scrollWeekToWindowStart(): void {
    setTimeout(() => {
      const scroller = this.weekScroll?.nativeElement;
      if (!scroller) return;
      const target = this.isViewingToday() ? Math.max(0, this.nowPx() - 3 * WEEK_HOUR_PX) : 0;
      scroller.scrollTo({ top: target });
    });
  }
}

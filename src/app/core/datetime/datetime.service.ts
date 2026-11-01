import { Injectable, InjectionToken, inject } from '@angular/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { Dayjs } from 'dayjs';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Zona horaria del navegador, única fuente de verdad — jamás hardcodear 'America/Bogota'. */
export const TIMEZONE = new InjectionToken<string>('TIMEZONE', {
  providedIn: 'root',
  factory: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
});

@Injectable({ providedIn: 'root' })
export class DatetimeService {
  private readonly tz = inject(TIMEZONE);

  readonly zone = this.tz;

  /** Devuelve el instante actual en la zona horaria configurada del navegador. */
  now(): Dayjs {
    return dayjs().tz(this.tz);
  }

  /** fecha ISO/UTC del backend → zona del navegador */
  fromUtc(iso: string): Dayjs {
    return dayjs.utc(iso).tz(this.tz);
  }

  /** construye un dayjs en la zona del navegador a partir de campos sueltos */
  at(year: number, monthIndex: number, day = 1): Dayjs {
    return dayjs().year(year).month(monthIndex).date(day).tz(this.tz, true);
  }
}

import { Pipe, PipeTransform, inject } from '@angular/core';

import { DatetimeService } from '../../core/datetime/datetime.service';

/** Formatea fechas de la API con una salida consistente para toda la interfaz. */
@Pipe({ name: 'dateFmt' })
export class DateFmtPipe implements PipeTransform {
  private readonly datetime = inject(DatetimeService);

  transform(value: string | null | undefined): string {
    return value ? this.datetime.fromUtc(value).format('DD MMM YYYY') : '—';
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Appointment } from '../modelos/appointment.model';

export interface CalendarDay {
  readonly date: Date;
  readonly key: string;
  readonly dayNumber: number;
  readonly belongsToMonth: boolean;
  readonly isToday: boolean;
  readonly appointments: readonly Appointment[];
}

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  template: `
    <section class="month-calendar" aria-label="Calendario mensual">
      <div class="calendar-weekdays">
        @for (weekday of weekdays; track weekday) { <div>{{ weekday }}</div> }
      </div>
      @for (week of weeks(); track $index) {
        <div class="calendar-week">
          @for (day of week; track day.key) {
            <button type="button" class="calendar-day" [class.outside-month]="!day.belongsToMonth"
              [class.selected-day]="selectedKey() === day.key" [class.today]="day.isToday"
              [attr.aria-label]="day.key + ', ' + day.appointments.length + ' citas'"
              (click)="daySelected.emit(day.date)">
              <span class="day-number">{{ day.dayNumber }}</span>
              @if (day.appointments.length) {
                <span class="day-appointments">
                  @for (appointment of day.appointments.slice(0, 2); track appointment.id) {
                    <span class="calendar-appointment"><b>{{ appointment.time }}</b> {{ appointment.client }}</span>
                  }
                  @if (day.appointments.length > 2) { <span class="more-appointments">+{{ day.appointments.length - 2 }} más</span> }
                </span>
              }
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [`:host{display:block}.month-calendar{overflow:hidden;border:1px solid #23414b;border-radius:15px;background:#0d2026}.calendar-weekdays,.calendar-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.calendar-weekdays{background:#1d3b46}.calendar-weekdays div{display:grid;min-height:74px;place-items:center;border-right:1px solid #23434d;color:#d5f0f7;font-size:13px;font-weight:750}.calendar-week{min-height:145px}.calendar-day{display:flex;min-width:0;min-height:145px;flex-direction:column;align-items:stretch;gap:9px;border:0;border-top:1px solid #1b343c;border-right:1px solid #1b343c;background:transparent;padding:15px 13px;color:#c5dfe5;text-align:left;cursor:pointer}.calendar-day:hover{background:#142c34}.calendar-day.outside-month{color:#47717f}.calendar-day.today .day-number{display:grid;width:28px;height:28px;place-items:center;border-radius:50%;background:#36d5f2;color:#06232c;font-weight:800}.calendar-day.selected-day{box-shadow:inset 0 0 0 2px #31cde9}.day-number{font-size:14px;font-weight:700}.day-appointments{display:grid;gap:5px}.calendar-appointment{overflow:hidden;border-left:2px solid #34d5ef;border-radius:4px;background:#183943;padding:5px 6px;color:#c9e9ef;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.calendar-appointment b{color:#43d8f2}.more-appointments{color:#61d8ea;font-size:10px}@media(max-width:760px){.calendar-weekdays div{min-height:43px;font-size:10px}.calendar-week{min-height:76px}.calendar-day{min-height:76px;gap:5px;padding:7px 5px}.day-number{font-size:11px}.calendar-appointment{padding:3px;font-size:8px}.calendar-appointment b{display:none}.more-appointments{font-size:8px}}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarGrid {
  readonly weeks = input.required<readonly (readonly CalendarDay[])[]>();
  readonly selectedKey = input.required<string>();
  readonly daySelected = output<Date>();
  protected readonly weekdays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';

import { BusinessPlanResponse } from '../../../../core/api/openapi/model/businessPlanResponse';
import { BusinessPlanUsageResponse } from '../../../../core/api/openapi/model/businessPlanUsageResponse';
import { PlanResponse } from '../../../../core/api/openapi/model/planResponse';
import { DateFmtPipe } from '../../../../shared/pipes/date-fmt.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { UsageChart } from './usage-chart';

export interface PlanChangeRequest {
  readonly planId: number;
  readonly activationCode?: string;
}

interface PlanUsageItem {
  readonly label: string;
  readonly unlimited: boolean;
  readonly used: number;
  readonly limit: number;
  readonly data: ChartConfiguration<'doughnut'>['data'];
  readonly options: ChartConfiguration<'doughnut'>['options'];
  readonly statusText: string;
  readonly statusCls: string;
}

const STATUS_META: Record<string, { readonly label: string; readonly cls: string }> = {
  TRIAL: { label: 'Prueba', cls: 'status-pending' },
  ACTIVE: { label: 'Activo', cls: 'status-accepted' },
  PAST_DUE: { label: 'Mora', cls: 'status-cancelled' },
  CANCELLED: { label: 'Cancelado', cls: 'status-cancelled' },
  EXPIRED: { label: 'Expirado', cls: 'status-expired' },
};

/** Plan actual, uso con gráficas, catálogo e historial; el padre ejecuta el cambio. */
@Component({
  selector: 'app-plan-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DateFmtPipe, FormsModule, Icon, UsageChart],
  templateUrl: './plan-tab.html',
})
export class PlanTab {
  readonly plan = input<BusinessPlanUsageResponse | null>(null);
  readonly availablePlans = input<readonly PlanResponse[]>([]);
  readonly planHistory = input<readonly BusinessPlanResponse[]>([]);
  readonly changingPlanId = input<number | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly changeCompleted = input(0);

  readonly changePlan = output<PlanChangeRequest>();

  protected readonly codes = signal<Record<number, string>>({});

  protected readonly currentPlanId = computed(() => this.plan()?.plan?.planId ?? null);
  protected readonly subscriptionStatus = computed<string>(
    () => this.plan()?.subscriptionStatus ?? '',
  );
  protected readonly planName = computed(() => {
    const plan = this.plan()?.plan;
    return plan?.displayName || plan?.name || '—';
  });
  protected readonly planPrice = computed(() => this.plan()?.plan?.monthlyPriceCents ?? 0);
  protected readonly statusMeta = STATUS_META;

  protected readonly usageItems = computed<PlanUsageItem[]>(() => {
    const usage = this.plan();
    if (!usage) return [];
    const limits = usage.plan ?? {};
    return [
      buildUsage(
        'Servicios',
        usage.serviceCount,
        limits.serviceLimit,
        usage.serviceLimitReached,
        usage.serviceLimitExceeded,
      ),
      buildUsage(
        'Citas del mes',
        usage.currentMonthAppointmentCount,
        limits.monthlyAppointmentLimit,
        usage.appointmentLimitReached,
        usage.appointmentLimitExceeded,
      ),
      buildUsage(
        'Empleados',
        usage.employeeCount,
        limits.employeeLimit,
        usage.employeeLimitReached,
        usage.employeeLimitExceeded,
      ),
    ];
  });

  private lastChangeCompleted = 0;

  constructor() {
    effect(() => {
      const completed = this.changeCompleted();
      if (completed > this.lastChangeCompleted && !this.changingPlanId()) {
        this.lastChangeCompleted = completed;
        this.codes.set({});
      }
    });
  }

  protected statusLabel(status?: string): string {
    return status ? (STATUS_META[status]?.label ?? status) : '—';
  }

  protected statusClass(status?: string): string {
    return status ? (STATUS_META[status]?.cls ?? 'status-default') : 'status-default';
  }

  protected setCode(planId: number | undefined, value: string): void {
    if (planId == null) return;
    this.codes.update((codes) => ({ ...codes, [planId]: value }));
  }

  protected requestPlanChange(plan: PlanResponse): void {
    if (plan.planId == null) return;
    const activationCode = this.codes()[plan.planId]?.trim() || undefined;
    this.changePlan.emit({ planId: plan.planId, activationCode });
  }
}

function buildUsage(
  label: string,
  used: number | undefined,
  limit: number | undefined,
  reached: boolean | undefined,
  exceeded: boolean | undefined,
): PlanUsageItem {
  const safeLimit = Number(limit) || 0;
  const safeUsed = Number(used) || 0;
  if (safeLimit <= 0) {
    return {
      label,
      unlimited: true,
      used: safeUsed,
      limit: safeLimit,
      data: { labels: [], datasets: [] },
      options: {},
      statusText: 'Sin límite',
      statusCls: 'plan-status-ok',
    };
  }

  const color = exceeded ? '#ff8a8a' : reached ? '#ffc75b' : '#3fe1ff';
  return {
    label,
    unlimited: false,
    used: safeUsed,
    limit: safeLimit,
    data: {
      labels: ['Uso', 'Disponible'],
      datasets: [
        {
          data: [safeUsed, Math.max(0, safeLimit - safeUsed)],
          backgroundColor: [color, 'rgba(255, 255, 255, 0.08)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '72%',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    statusText: exceeded ? 'Límite superado' : reached ? 'Límite alcanzado' : 'Disponible',
    statusCls: exceeded ? 'plan-status-exceeded' : reached ? 'plan-status-reached' : 'plan-status-ok',
  };
}

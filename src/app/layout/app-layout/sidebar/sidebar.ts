import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { Permissions } from '../../../core/auth/permissions';
import { SettingsStore } from '../../../core/settings/settings.store';
import { Icon } from '../../../shared/ui/icon/icon';
import { NavItem } from '../nav-item';

interface PlanUsageBar {
  readonly label: string;
  readonly text: string;
  readonly pct: number;
  readonly cls: string;
}

const ICONS = {
  home: 'home',
  wrench: 'wrench',
  clock: 'clock',
  settings: 'settings',
  users: 'users',
} as const;

/** Equivalente de Sidebar.vue — barra lateral fija (mobile oculta por CSS) */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:click)': 'closeMenu($event)' },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly settings = inject(SettingsStore);
  private readonly permissions = inject(Permissions);

  readonly userMenuOpen = signal(true);

  /** navItems — solo las secciones que el usuario puede accionar (permisos del shell) */
  readonly navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [
      { path: '/calendario', label: 'Calendario', icon: ICONS.home },
    ];
    if (this.permissions.canManageSchedules()) {
      items.push({ path: '/horarios', label: 'Horarios', icon: ICONS.clock });
    }
    if (this.permissions.canManageServices()) {
      items.push({ path: '/servicios', label: 'Servicios', icon: ICONS.wrench });
      items.push({ path: '/resenas', label: 'Reseñas', icon: ICONS.users });
    }
    if (!this.auth.isBusiness()) {
      items.push({ path: '/negocios-recientes', label: 'Negocios recientes', icon: ICONS.clock });
    }
    items.push({ path: '/configuracion', label: 'Configuración', icon: ICONS.settings });
    return items;
  });

  /** sidebarBusiness — Datos del negocio para la tarjeta (solo dueño con negocio) */
  readonly sidebarBusiness = computed<{ name: string; category: string; logoUrl: string } | null>(() => {
    const business = this.settings.businessData();
    if (!business?.name) return null;
    return {
      name: business.name,
      category: business.category || 'Negocio',
      logoUrl: business.logoUrl || '',
    };
  });

  readonly businessInitial = computed(() => {
    const name = this.settings.businessData()?.name || '';
    const initial = name.trim()[0];
    return initial ? initial.toUpperCase() : 'N';
  });

  /** publicUrl — del slug del negocio (claim del JWT) */
  readonly publicUrl = computed(() => {
    const slug = this.auth.user()?.slug;
    return slug ? `${window.location.origin}/negocio/${slug}` : '';
  });

  /** planUsage — Barras de uso del plan de la card de upgrade */
  readonly planUsage = computed<PlanUsageBar[]>(() => {
    const plan = this.settings.plan();
    if (!plan?.plan) return [];
    const limits = plan.plan;
    const rawItems = [
      { label: 'Servicios', used: plan.serviceCount, limit: limits.serviceLimit, reached: plan.serviceLimitReached, exceeded: plan.serviceLimitExceeded },
      { label: 'Citas del mes', used: plan.currentMonthAppointmentCount, limit: limits.monthlyAppointmentLimit, reached: plan.appointmentLimitReached, exceeded: plan.appointmentLimitExceeded },
    ];
    return rawItems
      .filter((item) => Number(item.limit) > 0)
      .map((item) => {
        const used = Number(item.used) || 0;
        const limit = Number(item.limit);
        const pct = Math.min(100, Math.round((used / limit) * 100));
        let cls = 'usage-fill-normal';
        if (item.exceeded || item.reached || pct >= 100) cls = 'usage-fill-danger';
        else if (pct >= 75) cls = 'usage-fill-warning';
        return { label: item.label, text: `${used}/${limit}`, pct, cls };
      });
  });

  readonly initials = computed(() => {
    const profile = this.settings.profile();
    const first = profile?.name?.trim()[0] ?? '';
    const last = profile?.lastName?.trim()[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  });

  readonly displayName = computed(() => {
    const profile = this.settings.profile();
    const name = [profile?.name, profile?.lastName].filter(Boolean).join(' ').trim();
    return name || this.auth.user()?.name || 'Usuario';
  });

  readonly displayEmail = computed(() => this.settings.profile()?.email || '—');

  readonly showUpgradeCard = computed(() => {
    // isFreePlan de Vue — nombre free/… o estado trial/expird/cancelado
    if (!this.permissions.isOwner()) return false;
    const plan = this.settings.plan();
    if (!plan?.plan) return false;
    const name = String(plan.plan.displayName ?? '').toLowerCase();
    const status = String(plan.subscriptionStatus ?? '').toUpperCase();
    const freeNames = ['free', 'gratis', 'gratuito', 'basico', 'básico', 'basic'];
    const nameIsFree = freeNames.some((free) => name.includes(free));
    const statusIsFree = ['TRIAL', 'EXPIRED', 'CANCELLED'].includes(status);
    return nameIsFree || statusIsFree;
  });

  constructor() {
    if (!this.settings.profileLoaded()) {
      void this.settings.fetchAll(this.permissions.isOwner()).catch(() => undefined);
    }
  }

  isActive(item: NavItem): boolean {
    return this.router.isActive(item.path, {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  navigate(item: NavItem): void {
    if (!this.isActive(item)) this.router.navigate([item.path]);
  }

  goPlan(): void {
    this.router.navigate(['/configuracion'], { queryParams: { tab: 'plan' } });
  }

  handleLogout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/iniciar-sesion']);
  }

  closeMenu(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('.sidebar-user-section')) {
      this.userMenuOpen.set(false);
    }
  }
}

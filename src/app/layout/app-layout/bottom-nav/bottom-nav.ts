import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { Permissions } from '../../../core/auth/permissions';
import { NavItem } from '../nav-item';

const ICONS = {
  home: 'images/icons/home.svg',
  wrench: 'images/icons/wrench.svg',
  clock: 'images/icons/clock.svg',
  settings: 'images/icons/settings.svg',
  users: 'images/icons/users.svg',
} as const;

/** Equivalente de BottomNav.vue — barra inferior para mobile (<= 768px por CSS) */
@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.html',
})
export class BottomNav {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(Permissions);

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
      items.push({ path: '/mis-citas', label: 'Mis citas', icon: ICONS.clock });
    }
    items.push({ path: '/configuracion', label: 'Configuración', icon: ICONS.settings });
    return items;
  });

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
}

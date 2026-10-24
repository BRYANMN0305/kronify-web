import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthStore, apiErrorMessage } from '../../../../core/auth/auth.store';
import { Permissions } from '../../../../core/auth/permissions';
import { SettingsStore } from '../../../../core/settings/settings.store';
import { UserUpdateRequest } from '../../../../core/api/openapi/model/userUpdateRequest';
import { Icon, IconName } from '../../../../shared/ui/icon/icon';
import { MyDetailsTab } from '../../ui/my-details-tab/my-details-tab';

type SettingsTab = 'details' | 'profile' | 'plan' | 'password' | 'team';

interface SettingsNavItem {
  readonly key: SettingsTab;
  readonly label: string;
  readonly icon: IconName;
}

interface SettingsNavGroup {
  readonly label: string;
  readonly items: readonly SettingsNavItem[];
}

interface SettingsContentMeta {
  readonly title: string;
  readonly subtitle: string;
}

const VALID_TABS: readonly SettingsTab[] = ['details', 'profile', 'plan', 'password', 'team'];

const CONTENT_META: Record<SettingsTab, SettingsContentMeta> = {
  details: { title: 'Mis datos', subtitle: 'Actualiza tu información personal' },
  password: { title: 'Contraseña', subtitle: 'Cambia la contraseña de acceso a tu cuenta' },
  profile: { title: 'Perfil del negocio', subtitle: 'Datos públicos de tu negocio' },
  plan: { title: 'Plan', subtitle: 'Plan y límites de tu negocio' },
  team: { title: 'Equipo', subtitle: 'Invita a empleados a trabajar en tu negocio' },
};

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MyDetailsTab],
  templateUrl: './settings-page.html',
  styleUrl: '../../styles/settings.css',
  encapsulation: ViewEncapsulation.None,
})
export class SettingsPage implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(Permissions);
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeTab = signal<SettingsTab>('details');
  protected readonly loading = this.settings.loading;
  protected readonly error = this.settings.error;
  protected readonly contentMeta = CONTENT_META;
  protected readonly profile = this.settings.profile;
  protected readonly authMethods = this.settings.authMethods;
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveCompleted = signal(0);

  protected readonly navGroups = computed<SettingsNavGroup[]>(() => {
    const groups: SettingsNavGroup[] = [
      {
        label: 'Cuenta',
        items: [
          { key: 'details', label: 'Mis datos', icon: 'user' },
          { key: 'password', label: 'Contraseña', icon: 'lock' },
        ],
      },
    ];
    if (this.permissions.isOwner()) {
      groups.push({
        label: 'Negocio',
        items: [
          { key: 'profile', label: 'Perfil del negocio', icon: 'briefcase' },
          { key: 'plan', label: 'Plan', icon: 'credit-card' },
          { key: 'team', label: 'Equipo', icon: 'users' },
        ],
      });
    }
    return groups;
  });

  protected readonly effectiveTab = computed<SettingsTab>(() => {
    const allowed = this.navGroups().flatMap((group) => group.items.map((item) => item.key));
    const current = this.activeTab();
    return allowed.includes(current) ? current : (allowed[0] ?? 'details');
  });

  protected readonly initials = computed(() => {
    const profile = this.profile();
    const first = profile?.name?.trim()[0] ?? '';
    const last = profile?.lastName?.trim()[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  });

  protected readonly displayName = computed(() => {
    const profile = this.profile();
    const name = [profile?.name, profile?.lastName].filter(Boolean).join(' ').trim();
    return name || this.auth.user()?.name || 'Usuario';
  });

  protected readonly displayEmail = computed(() => this.profile()?.email || '—');

  protected readonly profileRole = computed(() => {
    if (this.permissions.isOwner()) return 'Dueño del negocio';
    if (this.auth.isBusiness()) return 'Empleado';
    return 'Cliente';
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params.get('tab');
      if (isSettingsTab(tab)) this.activeTab.set(tab);
    });
  }

  ngOnInit(): void {
    if (!this.settings.loading()) {
      void this.settings.fetchAll(this.permissions.isOwner());
    }
  }

  protected selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  protected goBack(): void {
    void this.router.navigate(['/calendario']);
  }

  protected handleEditStarted(): void {
    this.saveError.set(null);
  }

  protected async handleSaveProfile(payload: UserUpdateRequest): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.settings.updateProfile(payload);
      this.saveCompleted.update((count) => count + 1);
    } catch (error) {
      this.saveError.set(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected handleLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/iniciar-sesion']);
  }
}

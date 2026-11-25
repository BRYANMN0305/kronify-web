import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { ServiceRequest } from '../../../../core/api/openapi/model/serviceRequest';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';
import { ServiceFormComponent } from '../../ui/service-form/service-form';

/** Crea, edita y elimina los servicios que ofrece el negocio. */
@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, ServiceFormComponent],
  templateUrl: './services-page.html',
  styleUrl: './services-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage implements OnInit {
  private readonly api = inject(ServiceControllerService);
  private readonly destroyRef = inject(DestroyRef);

  /** Referencia al formulario para reiniciarlo cuando el alta termina. */
  private readonly serviceForm = viewChild(ServiceFormComponent);

  protected readonly services = signal<readonly ServiceResponse[]>([]);
  protected readonly editingService = signal<ServiceResponse | null>(null);
  protected readonly pendingDelete = signal<ServiceResponse | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  /**
   * La búsqueda vive en un FormControl para reaccionar a cada tecla y esperar
   * 300 ms de pausa antes de filtrar. La lista solo se recalcula cuando cambia
   * el término, no en cada pulsación.
   */
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm = signal('');

  /** Catálogo filtrado por nombre o descripción, igual que el buscador de la versión Vue. */
  protected readonly filteredServices = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.services();
    return this.services().filter(
      (service) =>
        (service.name ?? '').toLowerCase().includes(term) ||
        (service.description ?? '').toLowerCase().includes(term),
    );
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchTerm.set(term));
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.busy.set(true);
    try {
      this.services.set((await firstValueFrom(this.api.listServices())) ?? []);
    } catch {
      this.error.set('No se pudieron cargar los servicios.');
    } finally {
      this.busy.set(false);
    }
  }

  protected edit(service: ServiceResponse): void {
    if (service.id == null) return;
    this.editingService.set(service);
    this.notice.set(null);
    this.error.set(null);
  }

  protected cancelEdit(): void {
    this.editingService.set(null);
  }

  /**
   * Recibe el `ServiceRequest` que emite el formulario reactivo, decide si es
   * alta o edición y refresca el catálogo. Al terminar reinicia el formulario
   * desde la referencia `viewChild`, sin recargar la página.
   */
  protected async save(request: ServiceRequest): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    const editing = this.editingService();
    try {
      if (editing?.id == null) {
        await firstValueFrom(this.api.createService(request));
      } else {
        await firstValueFrom(this.api.updateService(editing.id, request));
      }

      this.services.set((await firstValueFrom(this.api.listServices())) ?? []);
      this.editingService.set(null);
      this.serviceForm()?.reset();
      this.notice.set(editing?.id == null ? 'Servicio creado.' : 'Cambios guardados.');
    } catch {
      this.error.set('No se pudo guardar el servicio. Revisa los datos e inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(id: number): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await firstValueFrom(this.api.deleteService(id));
      this.services.set((await firstValueFrom(this.api.listServices())) ?? []);
      if (this.editingService()?.id === id) this.cancelEdit();
      this.notice.set('Servicio eliminado.');
    } catch {
      this.error.set('No se pudo eliminar el servicio.');
    } finally {
      this.busy.set(false);
    }
  }

  protected requestDelete(service: ServiceResponse): void {
    if (service.id == null) return;
    this.pendingDelete.set(service);
  }

  /** Cierra el modal solo cuando el clic cae fuera del panel. */
  protected onDeleteBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeDelete();
  }

  protected closeDelete(): void {
    this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (target?.id == null) return;
    await this.remove(target.id);
    this.pendingDelete.set(null);
  }
}

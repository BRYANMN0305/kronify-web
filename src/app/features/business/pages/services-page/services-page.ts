import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ServiceControllerService } from '../../../../core/api/openapi/api/serviceController.service';
import type { ServiceRequest } from '../../../../core/api/openapi/model/serviceRequest';
import type { ServiceResponse } from '../../../../core/api/openapi/model/serviceResponse';

/** Crea, edita y elimina los servicios que ofrece el negocio. */
@Component({
  selector: 'app-services-page', standalone: true, imports: [FormsModule, CurrencyPipe],
  templateUrl: './services-page.html', styleUrl: './services-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage implements OnInit {
  private readonly api = inject(ServiceControllerService);
  protected readonly services = signal<readonly ServiceResponse[]>([]);
  protected readonly form = signal({ name: '', description: '', durationMinutes: 30, bufferMinutes: 0, price: 0 });
  protected readonly editingId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.busy.set(true);
    try { this.services.set((await firstValueFrom(this.api.listServices())) ?? []); }
    catch { this.error.set('No se pudieron cargar los servicios.'); }
    finally { this.busy.set(false); }
  }
  protected update<K extends keyof ReturnType<typeof this.form>>(field: K, value: ReturnType<typeof this.form>[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }
  protected edit(service: ServiceResponse): void {
    if (service.id == null) return;
    this.editingId.set(service.id);
    this.form.set({ name: service.name ?? '', description: service.description ?? '', durationMinutes: service.durationMinutes ?? 30, bufferMinutes: service.bufferMinutes ?? 0, price: service.price ?? 0 });
    this.notice.set(null); this.error.set(null);
  }
  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.set({ name: '', description: '', durationMinutes: 30, bufferMinutes: 0, price: 0 });
  }
  protected async save(): Promise<void> {
    const draft = this.form();
    if (!draft.name.trim() || draft.durationMinutes < 1 || draft.price < 0) return;
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    const payload: ServiceRequest = { ...draft, name: draft.name.trim() };
    try {
      const id = this.editingId();
      if (id == null) await firstValueFrom(this.api.createService(payload));
      else await firstValueFrom(this.api.updateService(id, payload));
      this.cancelEdit();
      this.services.set((await firstValueFrom(this.api.listServices())) ?? []);
      this.notice.set(id == null ? 'Servicio creado.' : 'Cambios guardados.');
    } catch { this.error.set('No se pudo guardar el servicio. Revisa los datos e inténtalo de nuevo.'); }
    finally { this.busy.set(false); }
  }
  protected async remove(id: number): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      await firstValueFrom(this.api.deleteService(id));
      this.services.set((await firstValueFrom(this.api.listServices())) ?? []);
      if (this.editingId() === id) this.cancelEdit();
      this.notice.set('Servicio eliminado.');
    } catch { this.error.set('No se pudo eliminar el servicio.'); }
    finally { this.busy.set(false); }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';

/** Selector de logo con arrastre y vista previa; acepta un archivo, URL o valor vacío. */
@Component({
  selector: 'app-logo-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo-upload.html',
  styleUrl: './logo-upload.css',
})
export class LogoUpload {
  readonly logoValue = model<File | string | null>(null);

  readonly dragOver = signal(false);
  readonly previewUrl = signal<string | null>(null);

  private readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private currentObjectUrl: string | null = null;

  constructor() {
    // Mantiene la vista previa actualizada y libera URLs temporales que ya no se usan.
    effect(() => {
      const value = this.logoValue();
      const nextPreview = value instanceof File ? URL.createObjectURL(value) : value;
      if (this.currentObjectUrl && this.currentObjectUrl !== nextPreview) {
        URL.revokeObjectURL(this.currentObjectUrl);
        this.currentObjectUrl = null;
      }
      this.currentObjectUrl = value instanceof File ? nextPreview : null;
      this.previewUrl.set(nextPreview);
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    });
  }

  triggerFileInput(): void {
    this.fileInputRef().nativeElement.click();
  }

  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.applyFile(file);
  }

  handleDrop(event: DragEvent): void {
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.applyFile(file);
  }

  removeLogo(): void {
    this.logoValue.set(null);
    const input = this.fileInputRef().nativeElement;
    input.value = '';
  }

  private applyFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    this.logoValue.set(file);
  }
}

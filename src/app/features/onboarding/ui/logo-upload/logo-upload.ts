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

/** Port de onboarding/LogoUpload.vue — dropzone con preview; model = File | URL | null */
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
    // watch(modelValue, immediate) de Vue — computar y revocar la URL de preview
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

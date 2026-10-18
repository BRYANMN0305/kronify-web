import { ChangeDetectionStrategy, Component, ElementRef, effect, input, model, signal, viewChild } from '@angular/core';

/** Port de onboarding/CategoryDropdown.vue — combobox de categorías con filtrado libre */
@Component({
  selector: 'app-category-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onClickOutside($event)' },
  templateUrl: './category-dropdown.html',
  styleUrl: './category-dropdown.css',
})
export class CategoryDropdown {
  readonly category = model.required<string>();
  readonly invalid = input<boolean>(false);

  readonly open = signal(false);
  readonly panelAbove = signal(false);

  private readonly rootRef = viewChild.required<ElementRef<HTMLElement>>('categoryRef');

  private static readonly CATEGORIES = [
    'Salud y Bienestar',
    'Belleza y Estética',
    'Consultoría y Coaching',
    'Educación y Cursos',
    'Servicios Profesionales',
    'Hogar y Mantenimiento',
    'Tecnología y Soporte',
    'Eventos y Fotografía',
    'Fitness y Deporte',
    'Alimentación y Nutrición',
    'Otro',
  ];

  readonly filtered = () => {
    const query = this.category().trim().toLowerCase();
    if (!query) return CategoryDropdown.CATEGORIES;
    return CategoryDropdown.CATEGORIES.filter((category) => category.toLowerCase().includes(query));
  };

  constructor() {
    // Igual que el watch(open) de Vue: reubicar el panel cuando se abre
    effect(() => {
      if (this.open()) {
        requestAnimationFrame(() => this.positionPanel());
      }
    });
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  onInput(input: HTMLInputElement): void {
    this.category.set(input.value);
    this.open.set(true);
  }

  select(category: string): void {
    this.category.set(category);
    this.open.set(false);
  }

  /** document:click-capture para cerrar al hacer click por fuera */
  onClickOutside(event: MouseEvent): void {
    const element = this.rootRef().nativeElement;
    if (this.open() && !element.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  private positionPanel(): void {
    const root = this.rootRef().nativeElement;
    const panel = root.querySelector<HTMLElement>('.category-panel');
    if (!panel) return;
    const triggerRect = root.getBoundingClientRect();
    const panelHeight = panel.scrollHeight;
    const gap = 4;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    this.panelAbove.set(panelHeight + gap > spaceBelow);
  }
}

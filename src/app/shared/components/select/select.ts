import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';
import { focusAdjacentField } from '../../../core/forms/focus-next';

export interface SelectOption {
  value: string;
  label: string;
}

let nextId = 0;

/** Tiempo entre letras para que "ma" busque "Ma..." y no "M" y después "A". */
const TYPEAHEAD_RESET_MS = 700;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

@Component({
  selector: 'app-select',
  imports: [OverlayModule],
  templateUrl: './select.html',
})
export class Select implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly injector = inject(Injector);

  readonly label = input<string | null>(null);
  readonly placeholder = input('Selecciona una opción');
  readonly options = input<SelectOption[]>([]);
  readonly hint = input<string | null>(null);
  readonly required = input(false);
  readonly errorMessages = input<Record<string, string>>({});

  protected readonly selectId = `app-select-${nextId++}`;
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly searchQuery = signal('');
  /** Opción resaltada con el teclado (índice dentro de filteredOptions). */
  protected readonly activeIndex = signal(0);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private typeahead = '';
  private typeaheadAt = 0;

  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null
  );

  /** El buscador solo aparece cuando hay suficientes opciones como para justificarlo. */
  protected readonly showSearch = computed(() => this.options().length > 8);

  protected readonly filteredOptions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.options();
    }
    return this.options().filter((option) => normalize(option.label).includes(normalize(query)));
  });

  protected readonly overlayPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Diferido con setTimeout: mutar los validadores del control durante la creación del
    // componente dispara NG0100 (ExpressionChangedAfterItHasBeenCheckedError) en el padre si
    // algo como [saveDisabled]="form.invalid" ya se evaluó en ese mismo ciclo de detección.
    setTimeout(() => {
      effect(() => {
        const control = this.ngControl?.control;
        control?.setValidators(this.required() ? [Validators.required] : []);
        control?.updateValueAndValidity();
      }, { injector: this.injector });
    });
  }

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    if (this.open()) {
      this.close();
    } else {
      this.openList();
    }
  }

  private openList(): void {
    this.searchQuery.set('');
    const selected = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(Math.max(selected, 0));
    this.open.set(true);
    // Con la lista abierta el teclado trabaja en ella: en el buscador si lo hay, si no en la lista.
    afterNextRender(
      () => {
        const panel = this.panel()?.nativeElement;
        const target = panel?.querySelector<HTMLElement>('input') ?? panel?.querySelector<HTMLElement>('[role=listbox]');
        target?.focus();
        this.scrollActiveIntoView();
      },
      { injector: this.injector }
    );
  }

  protected close(refocus = false): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
      if (refocus) {
        this.trigger().nativeElement.focus();
      }
    }
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected selectOption(option: SelectOption): void {
    this.setValue(option.value);
    this.close(true);
  }

  private setValue(value: string): void {
    if (value !== this.value()) {
      this.value.set(value);
      this.onChange(value);
    }
  }

  /**
   * Con la lista cerrada (igual que una lista desplegable de Windows/Mac): flechas, Alt+↓,
   * Enter o Espacio la abren; escribir letras elige la primera opción que empieza así.
   */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.open()) {
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      this.openList();
      return;
    }
    if (this.isPrintable(event)) {
      event.preventDefault();
      const match = this.findByTypeahead(event.key, this.options());
      if (match >= 0) {
        this.setValue(this.options()[match].value);
      }
    }
  }

  /** Con la lista abierta: ↑ ↓ Inicio Fin para moverse, Enter o Tab para elegir, Esc para cerrar. */
  protected onPanelKeydown(event: KeyboardEvent): void {
    const options = this.filteredOptions();
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(Math.min(this.activeIndex() + 1, last));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(Math.max(this.activeIndex() - 1, 0));
        return;
      case 'Home':
      case 'PageUp':
        event.preventDefault();
        this.moveActive(0);
        return;
      case 'End':
      case 'PageDown':
        event.preventDefault();
        this.moveActive(Math.max(last, 0));
        return;
      case 'Enter': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (option) {
          this.setValue(option.value);
        }
        this.close(true);
        return;
      }
      case 'Tab': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (option && !event.shiftKey) {
          this.setValue(option.value);
        }
        this.close(true);
        focusAdjacentField(this.trigger().nativeElement, event.shiftKey ? -1 : 1);
        return;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        return;
    }
    // Sin buscador, escribir letras salta a la opción que empieza así.
    if (!this.showSearch() && this.isPrintable(event)) {
      event.preventDefault();
      const match = this.findByTypeahead(event.key, options);
      if (match >= 0) {
        this.moveActive(match);
      }
    }
  }

  private moveActive(index: number): void {
    this.activeIndex.set(index);
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    this.panel()?.nativeElement.querySelector(`[data-index="${this.activeIndex()}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  private isPrintable(event: KeyboardEvent): boolean {
    return event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  private findByTypeahead(key: string, options: SelectOption[]): number {
    const now = Date.now();
    this.typeahead = now - this.typeaheadAt > TYPEAHEAD_RESET_MS ? key : this.typeahead + key;
    this.typeaheadAt = now;
    const prefix = normalize(this.typeahead);
    return options.findIndex((option) => normalize(option.label).startsWith(prefix));
  }

  protected get showError(): boolean {
    const control = this.ngControl?.control;
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected get errorMessage(): string | null {
    const control = this.ngControl?.control;
    if (!control?.errors) {
      return null;
    }
    if (control.errors['required']) {
      return this.errorMessages()['required'] ?? 'Este campo es obligatorio.';
    }
    return null;
  }
}

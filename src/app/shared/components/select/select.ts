import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, Injector, computed, effect, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

let nextId = 0;

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
    return this.options().filter((option) => option.label.toLowerCase().includes(query));
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
    this.open.update((value) => !value);
    if (this.open()) {
      this.searchQuery.set('');
    }
  }

  protected close(): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
    }
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected selectOption(option: SelectOption): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
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

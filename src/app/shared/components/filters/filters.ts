import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShortcutDirective } from '../../directives/shortcut.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DatePicker } from '../date-picker/date-picker';
import { Input as AppInput } from '../input/input';
import { Select, SelectOption } from '../select/select';

export type FilterFieldType = 'text' | 'select' | 'date';

export interface FilterField {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: SelectOption[];
  /** Solo type="date": límites ISO (ej. impedir buscar fechas futuras). */
  min?: string;
  max?: string;
}

export type FilterValues = Record<string, string | null>;

// Búsqueda en vivo: los campos de texto esperan a que el usuario deje de escribir (evita un
// request por cada tecla); select y fecha son elecciones discretas, se buscan al instante.
const TEXT_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-filters',
  imports: [FormsModule, AppInput, Select, DatePicker, TranslatePipe, ShortcutDirective],
  templateUrl: './filters.html',
  host: { '(keydown.enter)': 'onEnter($event)' },
})
export class Filters implements OnInit {
  readonly fields = input.required<FilterField[]>();
  /** Valores con los que arranca la barra (ej. una lista que abre filtrada en "Pendiente"),
   *  para que lo que se ve en los campos coincida con lo que la lista está filtrando. */
  readonly initialValues = input<FilterValues>({});

  readonly search = output<FilterValues>();
  readonly clear = output<void>();

  protected readonly values = signal<FilterValues>({});

  private debounceTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.values.set({ ...this.initialValues() });
  }

  /** Clave del primer campo de texto: la tecla "/" pone el cursor ahí. */
  protected readonly firstTextKey = computed(() => this.fields().find((field) => field.type === 'text')?.key ?? null);

  protected getValue(key: string): string | null {
    return this.values()[key] ?? null;
  }

  protected setValue(key: string, value: unknown, type: FilterFieldType): void {
    this.values.update((current) => ({ ...current, [key]: (value as string) || null }));
    clearTimeout(this.debounceTimer);
    if (type === 'text') {
      this.debounceTimer = setTimeout(() => this.emitSearch(), TEXT_DEBOUNCE_MS);
    } else {
      this.emitSearch();
    }
  }

  private emitSearch(): void {
    this.search.emit(this.values());
  }

  /** Enter en la barra de filtros busca al instante, sin esperar la pausa al escribir. */
  protected onEnter(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    clearTimeout(this.debounceTimer);
    this.emitSearch();
  }

  protected onClear(): void {
    clearTimeout(this.debounceTimer);
    this.values.set({});
    this.clear.emit();
  }
}

import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
}

export type FilterValues = Record<string, string | null>;

@Component({
  selector: 'app-filters',
  imports: [FormsModule, AppInput, Select, DatePicker, TranslatePipe],
  templateUrl: './filters.html',
})
export class Filters {
  readonly fields = input.required<FilterField[]>();

  readonly search = output<FilterValues>();
  readonly clear = output<void>();

  protected readonly values = signal<FilterValues>({});

  protected getValue(key: string): string | null {
    return this.values()[key] ?? null;
  }

  protected setValue(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: (value as string) || null }));
  }

  protected onSearch(): void {
    this.search.emit(this.values());
  }

  protected onClear(): void {
    this.values.set({});
    this.clear.emit();
  }
}

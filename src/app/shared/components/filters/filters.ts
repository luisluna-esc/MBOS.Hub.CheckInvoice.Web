import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DatePicker } from '../date-picker/date-picker';
import { Input as AppInput } from '../input/input';
import { PartySearchInput, PartySearchResult } from '../party-search-input/party-search-input';
import { Select, SelectOption } from '../select/select';

export type FilterFieldType = 'text' | 'select' | 'date' | 'party-search';

export interface FilterField {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: SelectOption[];
  /** Solo para type: 'party-search' — a qué se busca (Clientes o Proveedores). */
  partyMode?: 'client' | 'supplier';
}

export type FilterValues = Record<string, string | null>;

@Component({
  selector: 'app-filters',
  imports: [FormsModule, AppInput, Select, DatePicker, PartySearchInput, TranslatePipe],
  templateUrl: './filters.html',
})
export class Filters {
  readonly fields = input.required<FilterField[]>();

  readonly search = output<FilterValues>();
  readonly clear = output<void>();

  protected readonly values = signal<FilterValues>({});
  // Solo para mostrar el nombre del "party-search" ya elegido — el valor real que se envía
  // en `values` es el id, no el nombre.
  protected readonly partyLabels = signal<Record<string, string>>({});

  protected getValue(key: string): string | null {
    return this.values()[key] ?? null;
  }

  protected setValue(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: (value as string) || null }));
  }

  protected onPartyPicked(key: string, result: PartySearchResult): void {
    this.setValue(key, String(result.id));
    this.partyLabels.update((current) => ({ ...current, [key]: result.name }));
  }

  protected clearParty(key: string): void {
    this.setValue(key, null);
    this.partyLabels.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  protected onSearch(): void {
    this.search.emit(this.values());
  }

  protected onClear(): void {
    this.values.set({});
    this.partyLabels.set({});
    this.clear.emit();
  }
}

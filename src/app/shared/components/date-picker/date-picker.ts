import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NgControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { focusAdjacentField } from '../../../core/forms/focus-next';

interface CalendarDay {
  date: Date;
  label: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  disabled: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

let nextId = 0;

@Component({
  selector: 'app-date-picker',
  imports: [OverlayModule],
  templateUrl: './date-picker.html',
})
export class DatePicker implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly injector = inject(Injector);

  readonly label = input<string | null>(null);
  readonly placeholder = input('Selecciona una fecha');
  readonly hint = input<string | null>(null);
  readonly required = input(false);
  /** Fecha máxima permitida, formato ISO 'yyyy-MM-dd' (ej. hoy, para no permitir fechas futuras). */
  readonly max = input<string | null>(null);
  /** Fecha mínima permitida, formato ISO 'yyyy-MM-dd'. */
  readonly min = input<string | null>(null);
  readonly errorMessages = input<Record<string, string>>({});

  protected readonly pickerId = `app-date-picker-${nextId++}`;
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  /** Lo que se va escribiendo sobre el campo (ej. "13/10"), antes de confirmarlo. */
  protected readonly typed = signal<string | null>(null);
  /** Día resaltado con el teclado en el calendario abierto (ISO). */
  protected readonly focusedIso = signal<string | null>(null);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  private readonly today = new Date();
  protected readonly viewYear = signal(this.today.getFullYear());
  protected readonly viewMonth = signal(this.today.getMonth());

  protected readonly view = signal<'days' | 'years'>('days');
  protected readonly yearPageStart = signal(this.today.getFullYear() - 5);

  protected readonly yearOptions = computed(() => {
    const start = this.yearPageStart();
    return Array.from({ length: 12 }, (_, i) => start + i);
  });

  protected readonly yearRangeLabel = computed(() => {
    const years = this.yearOptions();
    return `${years[0]} - ${years[years.length - 1]}`;
  });

  protected isYearDisabled(year: number): boolean {
    const maxDate = this.max();
    const minDate = this.min();
    if (maxDate && year > Number(maxDate.slice(0, 4))) {
      return true;
    }
    if (minDate && year < Number(minDate.slice(0, 4))) {
      return true;
    }
    return false;
  }

  protected readonly overlayPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly monthLabel = computed(() => `${MONTH_NAMES[this.viewMonth()]} ${this.viewYear()}`);

  protected readonly displayValue = computed(() => {
    const value = this.value();
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  });

  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - firstWeekday);

    const maxDate = this.max();
    const minDate = this.min();

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const iso = this.toIso(date);
      days.push({
        date,
        label: date.getDate(),
        inCurrentMonth: date.getMonth() === month,
        isToday: this.isSameDay(date, this.today),
        disabled: (!!maxDate && iso > maxDate) || (!!minDate && iso < minDate),
      });
    }
    return days;
  });

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
      effect(
        () => {
          const validators: ValidatorFn[] = [];
          if (this.required()) {
            validators.push(Validators.required);
          }
          if (this.max() !== null) {
            validators.push(this.maxDateValidator(this.max()!));
          }
          if (this.min() !== null) {
            validators.push(this.minDateValidator(this.min()!));
          }

          const control = this.ngControl?.control;
          control?.setValidators(validators);
          control?.updateValueAndValidity();
        },
        { injector: this.injector }
      );
    });
  }

  private maxDateValidator(max: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }
      return value > max ? { maxDate: { max } } : null;
    };
  }

  private minDateValidator(min: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }
      return value < min ? { minDate: { min } } : null;
    };
  }

  writeValue(value: string | null): void {
    // Un formulario puede arrancar con '' (texto vacío): se trata como "sin fecha". Si llega con
    // hora ("2026-10-09T00:00:00"), se usa solo el día.
    const iso = /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? value!.slice(0, 10) : null;
    this.value.set(iso);
    if (iso) {
      const [year, month] = iso.split('-').map(Number);
      if (year && month) {
        this.viewYear.set(year);
        this.viewMonth.set(month - 1);
      }
    }
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
      this.openCalendar();
    }
  }

  private openCalendar(): void {
    this.typed.set(null);
    const start = this.value() || this.clamp(this.toIso(this.today));
    this.focusedIso.set(start);
    this.showMonthOf(start);
    this.view.set('days');
    this.open.set(true);
    afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: this.injector });
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

  /**
   * Sobre el campo cerrado, igual que un campo de fecha común:
   *  - números: escribir la fecha ("13102026", "13/10/26" o solo "13/10" para este año);
   *  - ↑ ↓: un día más o menos;  Supr / Retroceso: borrar;
   *  - Enter: confirma lo escrito (sin nada escrito, abre el calendario);
   *  - Alt+↓ o Espacio: abre el calendario;  Esc: descarta lo escrito.
   */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.open() || event.ctrlKey || event.metaKey) {
      return;
    }
    const key = event.key;
    if ((key === 'ArrowDown' && event.altKey) || key === ' ') {
      event.preventDefault();
      this.openCalendar();
      return;
    }
    if (event.altKey) {
      return;
    }
    if (/^[0-9]$/.test(key) || ((key === '/' || key === '-' || key === '.') && this.typed())) {
      event.preventDefault();
      const next = (this.typed() ?? '') + (/[0-9]/.test(key) ? key : '/');
      this.typed.set(next);
      if (next.replace(/\D/g, '').length === 8) {
        this.commitTyped();
      }
      return;
    }
    switch (key) {
      case 'Backspace':
        if (this.typed()) {
          event.preventDefault();
          const rest = this.typed()!.slice(0, -1);
          this.typed.set(rest || null);
        } else if (this.value() && !this.required()) {
          event.preventDefault();
          this.setValue(null);
        }
        return;
      case 'Delete':
        if (this.value() && !this.required()) {
          event.preventDefault();
          this.setValue(null);
        }
        return;
      case 'Escape':
        if (this.typed()) {
          event.preventDefault();
          event.stopPropagation();
          this.typed.set(null);
        }
        return;
      case 'Enter':
        event.preventDefault();
        if (this.typed()) {
          this.commitTyped();
        } else {
          this.openCalendar();
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.stepValue(1);
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.stepValue(-1);
        return;
    }
  }

  /** Al salir del campo, lo que se escribió y es una fecha válida se guarda; si no, se descarta. */
  protected onTriggerBlur(): void {
    if (this.typed() && !this.open()) {
      this.commitTyped();
    }
  }

  /**
   * Calendario abierto (como cualquier calendario): ← → un día, ↑ ↓ una semana, RePág / AvPág
   * un mes, Inicio / Fin el primer o último día del mes, Enter elige, Esc cierra.
   */
  protected onPanelKeydown(event: KeyboardEvent): void {
    if (this.view() !== 'days') {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.view.set('days');
      }
      return;
    }
    const focused = this.parseIso(this.focusedIso() ?? this.toIso(this.today));
    const move = (date: Date) => {
      const iso = this.clamp(this.toIso(date));
      this.focusedIso.set(iso);
      this.showMonthOf(iso);
    };
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        move(this.addDays(focused, -1));
        return;
      case 'ArrowRight':
        event.preventDefault();
        move(this.addDays(focused, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(this.addDays(focused, -7));
        return;
      case 'ArrowDown':
        event.preventDefault();
        move(this.addDays(focused, 7));
        return;
      case 'PageUp':
        event.preventDefault();
        move(this.addMonths(focused, -1));
        return;
      case 'PageDown':
        event.preventDefault();
        move(this.addMonths(focused, 1));
        return;
      case 'Home':
        event.preventDefault();
        move(new Date(focused.getFullYear(), focused.getMonth(), 1));
        return;
      case 'End':
        event.preventDefault();
        move(new Date(focused.getFullYear(), focused.getMonth() + 1, 0));
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const iso = this.focusedIso();
        if (iso && !this.isOutOfRange(iso)) {
          this.setValue(iso);
          this.close(true);
        }
        return;
      }
      case 'Tab':
        event.preventDefault();
        this.close(true);
        focusAdjacentField(this.trigger().nativeElement, event.shiftKey ? -1 : 1);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        return;
    }
  }

  protected isFocused(day: CalendarDay): boolean {
    return this.open() && this.focusedIso() === this.toIso(day.date);
  }

  /** "13", "13/10", "13/10/26", "13102026"... a fecha ISO; null si no es una fecha válida. */
  private parseTyped(text: string): string | null {
    const base = this.value() ? this.parseIso(this.value()!) : this.today;
    let day: number;
    let month = base.getMonth() + 1;
    let year = base.getFullYear();
    if (/[^0-9]/.test(text)) {
      const parts = text.split(/[^0-9]+/).filter(Boolean).map(Number);
      [day, month = month, year = year] = parts;
    } else {
      const digits = text;
      day = Number(digits.slice(0, 2));
      if (digits.length <= 2) {
        day = Number(digits);
      } else {
        month = Number(digits.slice(2, 4));
        if (digits.length > 4) {
          year = Number(digits.slice(4));
        }
      }
    }
    if (year < 100) {
      year += 2000;
    }
    const date = new Date(year, month - 1, day);
    if (!day || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return this.toIso(date);
  }

  private commitTyped(): boolean {
    const iso = this.parseTyped(this.typed() ?? '');
    this.typed.set(null);
    if (!iso) {
      return false;
    }
    this.setValue(iso);
    return true;
  }

  private stepValue(days: number): void {
    this.typed.set(null);
    const current = this.value() ? this.parseIso(this.value()!) : this.today;
    const next = this.value() ? this.addDays(current, days) : current;
    this.setValue(this.clamp(this.toIso(next)));
  }

  private setValue(iso: string | null): void {
    if (iso === this.value()) {
      return;
    }
    this.value.set(iso);
    this.onChange(iso);
    this.onTouched();
    if (iso) {
      this.showMonthOf(iso);
    }
  }

  private showMonthOf(iso: string): void {
    const date = this.parseIso(iso);
    this.viewYear.set(date.getFullYear());
    this.viewMonth.set(date.getMonth());
  }

  private isOutOfRange(iso: string): boolean {
    const max = this.max();
    const min = this.min();
    return (!!max && iso > max) || (!!min && iso < min);
  }

  private clamp(iso: string): string {
    const max = this.max();
    const min = this.min();
    if (max && iso > max) {
      return max;
    }
    if (min && iso < min) {
      return min;
    }
    return iso;
  }

  private parseIso(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private addMonths(date: Date, months: number): Date {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
  }

  protected openYearView(): void {
    this.yearPageStart.set(this.viewYear() - 5);
    this.view.set('years');
  }

  protected prevYearPage(): void {
    this.yearPageStart.update((year) => year - 12);
  }

  protected nextYearPage(): void {
    this.yearPageStart.update((year) => year + 12);
  }

  protected selectYear(year: number): void {
    if (this.isYearDisabled(year)) {
      return;
    }
    this.viewYear.set(year);
    this.view.set('days');
  }

  protected prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((year) => year - 1);
    } else {
      this.viewMonth.update((month) => month - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((year) => year + 1);
    } else {
      this.viewMonth.update((month) => month + 1);
    }
  }

  protected selectDay(day: CalendarDay): void {
    if (day.disabled) {
      return;
    }
    this.setValue(this.toIso(day.date));
    this.close(true);
  }

  protected isSelected(day: CalendarDay): boolean {
    const value = this.value();
    return !!value && value === this.toIso(day.date);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private toIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    const customMessages = this.errorMessages();
    if (control.errors['required']) {
      return customMessages['required'] ?? 'Este campo es obligatorio.';
    }
    if (control.errors['maxDate']) {
      return customMessages['maxDate'] ?? 'La fecha no puede ser en el futuro.';
    }
    if (control.errors['minDate']) {
      return customMessages['minDate'] ?? 'La fecha es anterior a la mínima permitida.';
    }
    return null;
  }
}

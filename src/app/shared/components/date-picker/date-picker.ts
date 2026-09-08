import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, Injector, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NgControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

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
    this.value.set(value ?? null);
    if (value) {
      const [year, month] = value.split('-').map(Number);
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
    this.open.update((value) => !value);
    this.view.set('days');
  }

  protected close(): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
    }
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
    const iso = this.toIso(day.date);
    this.value.set(iso);
    this.onChange(iso);
    this.close();
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

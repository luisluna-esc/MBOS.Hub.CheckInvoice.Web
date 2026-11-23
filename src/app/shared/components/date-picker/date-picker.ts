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

/** Año más antiguo que se acepta al escribir una fecha. */
const MIN_TYPED_YEAR = 2000;

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

  private readonly trigger = viewChild.required<ElementRef<HTMLInputElement>>('trigger');
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
   * Se escribe en el campo como en cualquier texto: "13102026" queda "13/10/2026" (la "/" se pone
   * sola); también vale "13/10/26" o solo "13/10" (este año). Con los 8 números la fecha se toma
   * sola; si no, al salir del campo o con Enter.
   */
  /**
   * Al entrar al campo (con clic o con Tab) se selecciona la fecha que tiene: lo que se escriba
   * la reemplaza. Antes, con la fecha ya puesta, el campo estaba lleno y no se podía escribir.
   */
  private selectOnMouseUp = false;

  protected onFieldFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
    this.selectOnMouseUp = true;
  }

  /** El clic que da el foco suelta la selección al levantar el botón: se evita solo esa vez. */
  protected onFieldMouseUp(event: MouseEvent): void {
    if (this.selectOnMouseUp) {
      event.preventDefault();
      this.selectOnMouseUp = false;
    }
  }

  /**
   * Arma "dd/mm/aaaa" mientras se escribe, con el cero y la barra solos:
   *  - día: si el primer número es 4 a 9 ya no puede ser de dos cifras ("5" queda "05/");
   *  - mes: si el primer número es 2 a 9, igual ("3" queda "03/");
   *  - un día o mes de una cifra seguido de "/", "." o "-" también lleva el cero ("1/" queda "01/");
   *  - con 1, 2 o 3 en el día (o 0 o 1 en el mes) se espera la segunda cifra.
   */
  private maskDate(raw: string): string {
    const parts = ['', '', ''];
    let index = 0;
    for (const ch of raw) {
      if (/[0-9]/.test(ch)) {
        if (index === 2) {
          if (parts[2].length < 4) {
            parts[2] += ch;
          }
          continue;
        }
        parts[index] += ch;
        const highest = index === 0 ? '3' : '1';
        if (parts[index].length === 1 && ch > highest) {
          parts[index] = `0${ch}`;
          index++;
        } else if (parts[index].length === 2) {
          index++;
        }
      } else if (/[/.\-]/.test(ch) && index < 2 && parts[index].length === 1) {
        parts[index] = `0${parts[index]}`;
        index++;
      }
    }
    let text = parts[0];
    if (index >= 1) {
      text += `/${parts[1]}`;
    }
    if (index >= 2) {
      text += `/${parts[2]}`;
    }
    return text;
  }

  protected onTyping(event: Event): void {
    this.selectOnMouseUp = false;
    const field = event.target as HTMLInputElement;
    let raw = field.value;
    // Si ya había una fecha completa y se sigue escribiendo números, se empieza una fecha nueva
    // con lo que se acaba de escribir (no se ignora la tecla).
    const typedNow = ((event as InputEvent).data ?? '').replace(/\D/g, '');
    if (raw.replace(/\D/g, '').length > 8 && typedNow) {
      raw = typedNow;
    }
    const deleting = ((event as InputEvent).inputType ?? '').startsWith('delete');
    let text = this.maskDate(raw);
    // Al borrar no se vuelve a poner la "/" del final (si no, nunca se podría borrar).
    if (deleting) {
      text = text.replace(/\/$/, '');
    }
    field.value = text;
    this.typed.set(text || null);
    this.typedError.set(null);
    if (!text && !this.required()) {
      this.setValue(null);
      return;
    }
    // Fecha completa (dd/mm/aaaa): se toma sin esperar a salir del campo.
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      this.commitTyped();
    }
  }

  /**
   * Teclas sobre el campo (además de escribir):
   *  - ↑ ↓: un día más o menos;
   *  - Enter: confirma lo escrito (sin nada escrito, abre el calendario);
   *  - Alt+↓: abre el calendario;  Esc: descarta lo escrito.
   */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.open() || event.ctrlKey || event.metaKey) {
      return;
    }
    const key = event.key;
    if (key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      this.openCalendar();
      return;
    }
    if (event.altKey) {
      return;
    }
    switch (key) {
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
      this.commitTyped(true);
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

  /** Mensaje cuando lo escrito no es una fecha que se pueda usar (ej. "01/02/2202"). */
  protected readonly typedError = signal<string | null>(null);

  /**
   * Años que se aceptan al escribir: desde 2000 hasta el año que viene. Así no entra "2202" ni
   * "1926" por un error de tipeo. Si el campo tiene su propio mínimo o máximo, manda ese.
   */
  private yearBounds(): { min: number; max: number } {
    const min = this.min() ? Number(this.min()!.slice(0, 4)) : MIN_TYPED_YEAR;
    const max = this.max() ? Number(this.max()!.slice(0, 4)) : this.today.getFullYear() + 1;
    return { min: Math.max(min, MIN_TYPED_YEAR), max: Math.min(max, this.today.getFullYear() + 1) };
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
    const { min, max } = this.yearBounds();
    if (year < min || year > max) {
      return null;
    }
    return this.toIso(date);
  }

  /**
   * Toma lo escrito. Si no es una fecha válida (día o mes que no existe, o un año fuera de rango
   * como 2202) avisa en rojo y no la guarda: mientras se escribe deja el texto para corregirlo;
   * al salir del campo vuelve a la fecha que había.
   */
  private commitTyped(leaving = false): boolean {
    const text = this.typed() ?? '';
    const iso = this.parseTyped(text);
    if (!iso) {
      const { min, max } = this.yearBounds();
      this.typedError.set(
        leaving
          ? `"${text}" no es una fecha válida (año entre ${min} y ${max}). Se dejó la fecha anterior.`
          : `Fecha no válida: revisa el día, el mes y el año (entre ${min} y ${max}).`
      );
      if (leaving) {
        this.typed.set(null);
      }
      return false;
    }
    this.typed.set(null);
    this.typedError.set(null);
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
    this.typedError.set(null);
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

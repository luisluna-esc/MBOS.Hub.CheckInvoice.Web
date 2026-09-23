import { Component, Injector, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NgControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel';

let nextId = 0;

@Component({
  selector: 'app-input',
  imports: [],
  templateUrl: './input.html',
})
export class Input implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly injector = inject(Injector);

  readonly label = input<string | null>(null);
  readonly placeholder = input('');
  readonly type = input<InputType>('text');
  readonly hint = input<string | null>(null);
  readonly required = input(false);
  readonly minLength = input<number | null>(null);
  readonly maxLength = input<number | null>(null);
  /** Valor mínimo permitido (solo type="number"). */
  readonly min = input<number | null>(null);
  /** Cantidad máxima de decimales permitidos (solo type="number"); también fija el `step` nativo. */
  readonly decimals = input<number | null>(null);
  /** Permite sobrescribir/agregar mensajes por clave de error (ej. { pattern: 'Formato inválido.' }) */
  readonly errorMessages = input<Record<string, string>>({});
  // Nombre "patternRule" (no "pattern"): Angular tiene un PatternValidator nativo que se
  // auto-adjunta a cualquier elemento con [pattern] + formControlName/ngModel, sin importar si
  // es un componente propio — coincide por nombre de atributo, no por selector de componente.
  /** Patrón adicional a validar (ej. requerir un "@" en un campo type="text" sin las restricciones de type="email"). */
  readonly patternRule = input<string | RegExp | null>(null);

  protected readonly stepAttr = computed<string | null>(() =>
    this.decimals() !== null ? (1 / Math.pow(10, this.decimals()!)).toString() : null
  );

  protected readonly inputId = `app-input-${nextId++}`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly showPassword = signal(false);

  // Se usa "text" en vez de "number" para el <input> real: los inputs number nativos vacían su
  // .value mientras el texto está en un estado intermedio no numérico (ej. "10." o "-"), lo que
  // borra lo que el usuario escribió por el binding reactivo. Las validaciones propias (min,
  // decimals, required) ya cubren la corrección, así que no se pierde nada.
  protected readonly effectiveType = computed<InputType>(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    if (this.type() === 'number') {
      return 'text';
    }
    return this.type();
  });

  protected readonly inputMode = computed<'decimal' | null>(() => (this.type() === 'number' ? 'decimal' : null));

  private onChange: (value: string) => void = () => {};
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
        const validators: ValidatorFn[] = [];
        if (this.required()) {
          validators.push(Validators.required);
        }
        if (this.minLength() !== null) {
          validators.push(Validators.minLength(this.minLength()!));
        }
        if (this.maxLength() !== null) {
          validators.push(Validators.maxLength(this.maxLength()!));
        }
        if (this.type() === 'email') {
          validators.push(Validators.email);
        }
        if (this.patternRule() !== null) {
          validators.push(Validators.pattern(this.patternRule()!));
        }
        if (this.min() !== null) {
          validators.push(Validators.min(this.min()!));
        }
        if (this.decimals() !== null) {
          validators.push(this.decimalsValidator(this.decimals()!));
        }

        const control = this.ngControl?.control;
        control?.setValidators(validators);
        control?.updateValueAndValidity();
      }, { injector: this.injector });
    });
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    if (this.type() === 'number' && this.decimals() !== null && this.value() !== '') {
      const parsed = Number(this.value());
      if (!Number.isNaN(parsed)) {
        const formatted = parsed.toFixed(this.decimals()!);
        this.value.set(formatted);
        this.onChange(formatted);
      }
    }
    this.onTouched();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  private decimalsValidator(maxDecimals: number): ValidatorFn {
    const pattern =
      maxDecimals > 0 ? new RegExp(`^-?\\d+(\\.\\d{1,${maxDecimals}})?$`) : /^-?\d+$/;
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return pattern.test(String(value)) ? null : { decimals: { max: maxDecimals } };
    };
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
    const errorKey = Object.keys(control.errors)[0];

    if (customMessages[errorKey]) {
      return customMessages[errorKey];
    }

    switch (errorKey) {
      case 'required':
        return 'Este campo es obligatorio.';
      case 'minlength':
        return `Debe tener al menos ${control.errors['minlength'].requiredLength} caracteres.`;
      case 'maxlength':
        return `No puede superar los ${control.errors['maxlength'].requiredLength} caracteres.`;
      case 'email':
        return 'Correo electrónico inválido.';
      case 'pattern':
        return 'Formato inválido.';
      case 'min':
        return `No puede ser menor que ${control.errors['min'].min}.`;
      case 'decimals':
        return `No puede tener más de ${control.errors['decimals'].max} decimales.`;
      default:
        return null;
    }
  }
}

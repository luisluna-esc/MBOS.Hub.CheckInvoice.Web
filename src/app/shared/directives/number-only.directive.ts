import { Directive, HostListener, inject, ElementRef } from '@angular/core';

/**
 * Campos de números escritos como <input type="number"> directo (sin app-input): el navegador
 * igual deja escribir "e", "E", "+" y "-". Aquí no entra ninguna letra ni símbolo: solo números,
 * el punto o la coma si el campo admite decimales (step con decimales) y el menos solo si admite
 * negativos (sin min o min menor a 0). Se aplica solo a todo input type="number" del componente
 * que la importa.
 */
@Directive({
  selector: 'input[type=number]',
})
export class NumberOnlyDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
      return; // Atajos y teclas de control (flechas, Tab, borrar…) pasan siempre.
    }
    const key = event.key;
    if (/[0-9]/.test(key)) {
      return;
    }
    const step = this.element.getAttribute('step');
    const allowDecimal = !step || step.includes('.') || step === 'any';
    const min = this.element.getAttribute('min');
    const allowNegative = min === null || Number(min) < 0;
    if ((key === '.' || key === ',') && allowDecimal && !this.element.value.includes('.')) {
      return;
    }
    if (key === '-' && allowNegative) {
      return;
    }
    event.preventDefault();
  }

  /** Pegar: solo si lo pegado es un número que el campo acepta. */
  @HostListener('paste', ['$event'])
  protected onPaste(event: ClipboardEvent): void {
    const text = (event.clipboardData?.getData('text') ?? '').trim().replace(',', '.');
    const step = this.element.getAttribute('step');
    const allowDecimal = !step || step.includes('.') || step === 'any';
    const pattern = allowDecimal ? /^-?\d+(\.\d+)?$/ : /^-?\d+$/;
    const min = this.element.getAttribute('min');
    const allowNegative = min === null || Number(min) < 0;
    if (!pattern.test(text) || (!allowNegative && text.startsWith('-'))) {
      event.preventDefault();
    }
  }
}

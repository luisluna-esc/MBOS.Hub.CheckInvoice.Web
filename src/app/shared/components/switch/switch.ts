import { Component, input, model } from '@angular/core';

let nextId = 0;

/** Interruptor encendido/apagado con su texto al lado. */
@Component({
  selector: 'app-switch',
  template: `
    <button
      type="button"
      role="switch"
      [id]="switchId"
      [attr.aria-checked]="checked()"
      class="inline-flex items-center gap-2 text-sm font-medium text-foreground focus:outline-none"
      (click)="checked.set(!checked())"
    >
      <span
        class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors"
        [class.bg-primary]="checked()"
        [class.border-primary]="checked()"
        [class.bg-background]="!checked()"
        [class.border-border]="!checked()"
      >
        <span
          class="inline-block size-3.5 rounded-full shadow transition-transform"
          [class.translate-x-4]="checked()"
          [class.translate-x-0.5]="!checked()"
          [class.bg-primary-foreground]="checked()"
          [class.bg-muted-foreground]="!checked()"
        ></span>
      </span>
      {{ label() }}
    </button>
  `,
})
export class Switch {
  readonly checked = model(false);
  readonly label = input('');
  protected readonly switchId = `app-switch-${nextId++}`;
}

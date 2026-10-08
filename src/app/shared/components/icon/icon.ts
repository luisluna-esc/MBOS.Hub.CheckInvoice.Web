import { Component, input } from '@angular/core';

/**
 * Ícono del menú. `name` es el valor que se guarda en la columna menu.icon (ej. "home",
 * "receipt"); si no hay un @case para ese nombre se muestra un punto. Para agregar un ícono
 * nuevo basta con un @case en icon.html, con el mismo nombre que se guarda en menu.icon.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  host: { class: 'contents' },
})
export class Icon {
  readonly name = input<string | null | undefined>(null);
}

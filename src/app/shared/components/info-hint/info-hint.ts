import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-info-hint',
  imports: [OverlayModule],
  templateUrl: './info-hint.html',
  host: { class: 'inline-flex' },
})
export class InfoHint {
  /** Título corto en negrita arriba de la explicación. Opcional. */
  readonly title = input<string | null>(null);
  /** Texto accesible del botón para lectores de pantalla (no se muestra). */
  readonly label = input('Más información');

  protected readonly open = signal(false);

  protected readonly overlayPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }
}

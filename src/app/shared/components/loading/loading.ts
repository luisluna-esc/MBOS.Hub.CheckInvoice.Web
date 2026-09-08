import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-loading',
  imports: [TranslatePipe],
  templateUrl: './loading.html',
})
export class Loading {
  /** true (por defecto) = overlay de toda la pantalla; false = cubre solo el contenedor
   * padre (que debe tener position: relative). */
  readonly fixed = input(true);
  readonly label = input<string | null>(null);

  // Anillo de puntos: cada uno gira a un ángulo distinto alrededor del centro y con una
  // opacidad decreciente, para que al rotar el grupo entero se vea como una estela.
  protected readonly dots = Array.from({ length: 8 }, (_, index) => ({
    transform: `translate(-50%, -50%) rotate(${index * 45}deg) translateY(-15px)`,
    opacity: `${1 - index * 0.11}`,
  }));
}

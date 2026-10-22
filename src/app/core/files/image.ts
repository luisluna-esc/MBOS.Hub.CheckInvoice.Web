import { environment } from '../../../environments/environment';

/** Límite del backend para la foto de un producto. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * URL de la foto de un producto. La versión (fecha de la foto) va en la URL para que el
 * navegador pueda guardarla en caché sin mostrar una foto vieja después de cambiarla.
 */
export function productImageUrl(productId: number, version: number | null | undefined): string {
  return `${environment.apiUrl}/Products/${productId}/image?v=${version ?? 0}`;
}

/**
 * Achica una foto antes de subirla (lado mayor de 1200 px, JPG): una foto de celular de 4 MB
 * queda en unos 200 KB y se ve igual en la pantalla y en la página del QR.
 */
export async function shrinkImage(file: File, maxSide = 1200, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  // Fondo blanco: un PNG transparente no queda negro al pasarlo a JPG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob ?? file;
}

/**
 * Revisa y achica la foto elegida para un producto: tiene que ser una imagen y no pasar de
 * 5 MB (antes y después de achicarla). Devuelve la foto lista para subir, o la clave del
 * mensaje de error. La usan el formulario del producto y el botón de la tabla.
 */
export async function prepareProductPhoto(file: File): Promise<{ photo: Blob } | { errorKey: string }> {
  if (!file.type.startsWith('image/')) {
    return { errorKey: 'products.form.photoInvalid' };
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return { errorKey: 'products.form.photoTooLarge' };
  }
  let photo: Blob;
  try {
    photo = await shrinkImage(file);
  } catch {
    // El navegador no pudo leerla (archivo dañado o formato que no es imagen de verdad).
    return { errorKey: 'products.form.photoInvalid' };
  }
  return photo.size > MAX_PRODUCT_IMAGE_BYTES ? { errorKey: 'products.form.photoTooLarge' } : { photo };
}

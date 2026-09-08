/**
 * Como Promise.all, pero si un catálogo falla (ej. el rol activo no tiene permiso para verlo)
 * no tumba a los demás — ese catálogo queda vacío y el resto carga con normalidad. Cada promesa
 * puede resolver a un tipo de arreglo distinto (ej. CatalogItem[] junto a SpecialCaseItem[]).
 */
export async function settleCatalogs<T extends readonly unknown[]>(
  promises: [...{ [K in keyof T]: Promise<T[K]> }]
): Promise<T> {
  const results = await Promise.allSettled(promises);
  return results.map((result) => (result.status === 'fulfilled' ? result.value : [])) as unknown as T;
}

/**
 * Tur tanımları: her tur pilot alanın doğrulanmış eserlerinden türe göre seçilir (yazılmış durak listesi yok).
 * Mobil uygulama sırayı gerçek yol grafiğiyle hesaplar; yönetim paneli kapsamı (fotoğraf, metin) bu tanımla sayar.
 */
export interface TourDef {
  /** i18n anahtar öneki: tours.<id>.title / .body */
  id: string;
  /** Eser türü slug'ları; null: pilot alandaki bütün eserler. */
  types: string[] | null;
}

export const TOURS: TourDef[] = [
  { id: "tum", types: null },
  { id: "hanlar", types: ["han", "bedesten", "carsi"] },
  { id: "camiler", types: ["cami", "mescit", "turbe"] },
  { id: "su", types: ["cesme", "sebil", "hamam"] },
];

/** Eser bu tura girer mi (türüne göre). */
export const inTour = (def: TourDef, workType: string | undefined): boolean =>
  def.types === null || (workType !== undefined && def.types.includes(workType));

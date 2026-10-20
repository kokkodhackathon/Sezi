import { Easing } from 'react-native-reanimated';

/**
 * Hareket token'ları (Emil Kowalski ilkeleri): ease-out, 300 ms altı, çıkış girişten hızlı.
 * Reduce motion açıkken bileşenler ölçek/kayma yerine yalnız opacity kullanır.
 */
export const ease = {
  /** Giriş ve basma. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Ekranda yer değiştirme, nefes alan iskelet. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** Alt panel. */
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
};

export const duration = { press: 140, release: 200, fade: 150, enter: 260, sheetIn: 320, sheetOut: 200 } as const;

export const pressScale = 0.96;

/** Sıralı giriş: 6. öğeden sonra gecikme artmaz. */
export const stagger = { step: 50, maxItems: 6 } as const;

/** Tür baloncuğu seçimi: hafif sekme. */
export const selectSpring = { duration: 350, dampingRatio: 0.7 } as const;

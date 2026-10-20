import type { SweetToneName } from '@sezi/shared';

const byType: Record<string, SweetToneName> = {
  // Firuze ana renkle karışmasın diye camiler kobalt; çeşme ve sebil firuze.
  cami: 'cobalt',
  medrese: 'saffron',
  kutuphane: 'saffron',
  turbe: 'plum',
  cesme: 'teal',
  sebil: 'teal',
  hamam: 'coral',
  imaret: 'coral',
};

/** Eser türünün tonu. Renk tek başına anlam taşımaz; glif siluet farkını verir. */
export function toneForType(slug: string): SweetToneName {
  return byType[slug] ?? 'sage';
}

/**
 * Navigasyon oturumunun konuşma metinleri. Bağımlılığı yok: gömülü ses üretim betiği
 * (`scripts/gen-voice-bundle.mts`) sabit cümleleri buradan okur.
 */
export const NAV_TEXT = {
  tr: {
    intro: (name: string, m: number) => `Hedef: ${name}. Yaklaşık ${m} metre.`,
    strollIntro: (n: number, m: number) => `Gezinti: ${n} anlatım noktası, yaklaşık ${m} metre.`,
    offroute: (m: number) => `Rotadan çıktınız. Bulunduğunuz yerden yeni rota: ${m} metre.`,
    blocked: (m: number) => `İleride yol kapalı. Sizi başka yoldan götürüyorum: ${m} metre.`,
    noRoute: 'Bulunduğunuz yerden rota bulunamadı. Lütfen bekleyin ya da yardım isteyin.',
    crowdOn: 'Ortam gürültülü. Bundan sonra titreşim ve ekran ışığıyla yönlendiriyorum.',
    crowdOff: 'Ortam sakinleşti. Sesli yönlendirme yeniden açık.',
  },
  en: {
    intro: (name: string, m: number) => `Destination: ${name}. About ${m} metres.`,
    strollIntro: (n: number, m: number) => `Stroll: ${n} story points, about ${m} metres.`,
    offroute: (m: number) => `You have left the route. New route from here: ${m} metres.`,
    blocked: (m: number) => `The way ahead is closed. Taking you another way: ${m} metres.`,
    noRoute: 'No route was found from here. Please wait or ask for help.',
    crowdOn: 'It is noisy here. From now on I will guide you with vibration and screen light.',
    crowdOff: 'It is quieter now. Spoken guidance is back on.',
  },
};

/** Sabit (ad ve sayı içermeyen) Türkçe oturum cümleleri. */
export const NAV_STATIC_TR = [NAV_TEXT.tr.noRoute, NAV_TEXT.tr.crowdOn, NAV_TEXT.tr.crowdOff];

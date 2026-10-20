import { z } from "zod";

import { UserProfile } from "./schemas";
import type { SweetToneName } from "./sweet-theme";

export const NAME_MAX = 60;
export const PASSWORD_MIN = 8;
export const CODE_LENGTH = 6;
/** Sunucudaki `max_frequency`: aynı adrese iki kod arasında en az bu kadar beklenir. */
export const RESEND_SECONDS = 60;

export const Email = z.string().trim().toLowerCase().email();
export const DisplayName = z.string().trim().min(1).max(NAME_MAX);
/** Sunucu kuralıyla aynı: en az 8 karakter, harf ve rakam (`password_requirements = letters_digits`). */
export const Password = z.string().min(PASSWORD_MIN).regex(/\p{L}/u).regex(/\d/);
export const Code = z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`));

export const AVATAR_TONES = ["teal", "cobalt", "coral", "saffron", "sage", "plum"] as const satisfies readonly SweetToneName[];
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Sunucu kuralıyla aynı: küçük harf, rakam, alt çizgi. Türkçe harf yok (adres ve arama için). */
export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(new RegExp(`^[a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`));

export const IdentitySchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  username: z.string().nullable(),
  avatar_path: z.string().nullable(),
  avatar_tone: z.enum(AVATAR_TONES),
  visibility: z.enum(["private", "public"]),
});
export type Identity = z.infer<typeof IdentitySchema>;
export type IdentityPatch = Partial<Pick<Identity, "display_name" | "username" | "avatar_tone" | "visibility">>;

export const KNOWN_AUTH_ERRORS = [
  "invalid_credentials",
  "email_not_confirmed",
  "weak_password",
  "otp_expired",
  "same_password",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_address_invalid",
  "reauthentication_not_valid",
] as const;
export type KnownAuthError = (typeof KNOWN_AUTH_ERRORS)[number];

/** Hesapla cihazlar arasında taşınan ayarlar. İl ve geliştirici seçenekleri cihaza özgü kalır. */
export const SyncedSettings = z.object({
  themeMode: z.enum(["system", "light", "dark"]).default("light"),
  /** Konuşma hızı (cihaz sesi ve Chirp oynatma hızı): 0.75 yavaş – 1.2 hızlı. */
  speechRate: z.number().min(0.5).max(1.5).default(0.95),
  /** Anlatım noktası sesi: otomatik ya da dokununca. */
  storyPlayback: z.enum(["auto", "tap"]).default("auto"),
});
export type SyncedSettings = z.infer<typeof SyncedSettings>;

export const PrefsSchema = z.object({ profile: UserProfile, settings: SyncedSettings });
export type Prefs = z.infer<typeof PrefsSchema>;

export const AccountRowSchema = z.object({
  user_id: z.string(),
  prefs: z.unknown().nullable(),
  prefs_updated_at: z.string().nullable(),
});
export type AccountRow = z.infer<typeof AccountRowSchema>;

/** İlk girişte profil satırı için görünen ad: kayıttaki ad → e-posta öneki → 'Sezi'. */
export function fallbackDisplayName(metaName: unknown, email: string | undefined): string {
  const fromMeta = DisplayName.safeParse(metaName);
  if (fromMeta.success) return fromMeta.data;
  const fromEmail = DisplayName.safeParse(email?.split("@")[0]);
  return fromEmail.success ? fromEmail.data : "Sezi";
}

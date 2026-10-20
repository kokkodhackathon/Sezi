import type { UserProfile } from "./schemas";

export type ProfileKey = "walker" | "wheelchair" | "blind" | "deaf";

export const COMPARE_PROFILES: Record<ProfileKey, Omit<UserProfile, "lang">> = {
  walker: { vision: "full", mobility: "none", hearing: "full", senses: { audio: true, haptic: true, visual: true } },
  wheelchair: { vision: "full", mobility: "wheelchair", hearing: "full", senses: { audio: true, haptic: true, visual: true } },
  blind: { vision: "blind", mobility: "cane", hearing: "full", senses: { audio: true, haptic: true, visual: false } },
  deaf: { vision: "full", mobility: "none", hearing: "deaf", senses: { audio: false, haptic: true, visual: true } },
};

export const profileFor = (key: ProfileKey, lang: "tr" | "en"): UserProfile => ({ ...COMPARE_PROFILES[key], lang });

export const PROFILE_KEYS: ProfileKey[] = ["walker", "wheelchair", "blind", "deaf"];

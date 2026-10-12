import { UserProfile } from '@sezi/shared';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const KEY = 'sezi.profile.v1';

/** Görme profiline göre önerilen duyu kanalları; kullanıcı onboarding'de değiştirebilir. */
export function defaultSenses(vision: UserProfile['vision']): UserProfile['senses'] {
  if (vision === 'blind') return { audio: true, haptic: true, visual: false };
  if (vision === 'low') return { audio: true, haptic: true, visual: true };
  return { audio: true, haptic: false, visual: true };
}

function load(): UserProfile | null {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return null;
    const parsed = UserProfile.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null; // şema değiştiyse onboarding yeniden açılır
  } catch {
    return null;
  }
}

interface ProfileContextValue {
  profile: UserProfile | null;
  saveProfile: (p: UserProfile) => void;
  resetProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(load);

  const saveProfile = useCallback((p: UserProfile) => {
    const valid = UserProfile.parse(p);
    Storage.setItemSync(KEY, JSON.stringify(valid));
    setProfile(valid);
  }, []);

  const resetProfile = useCallback(() => {
    Storage.removeItemSync(KEY);
    setProfile(null);
  }, []);

  const value = useMemo(() => ({ profile, saveProfile, resetProfile }), [profile, saveProfile, resetProfile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile, ProfileProvider içinde kullanılmalı');
  return ctx;
}

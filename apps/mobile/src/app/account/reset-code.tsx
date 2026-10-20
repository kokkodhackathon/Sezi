import { useLocalSearchParams } from 'expo-router';

import { CodeVerify } from '@/components/code-verify';

/** Şifre sıfırlama kodu: oturum açılır, yeni şifre ekranına geçilir. */
export default function VerifyReset() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  return <CodeVerify mode="recovery" email={email} />;
}

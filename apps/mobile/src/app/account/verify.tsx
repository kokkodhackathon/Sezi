import { useLocalSearchParams } from 'expo-router';

import { CodeVerify } from '@/components/code-verify';

/** Kayıt kodu: hesap doğrulanır ve oturum açılır. */
export default function VerifySignup() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  return <CodeVerify mode="signup" email={email} />;
}

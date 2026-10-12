import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, EmptyState, Field, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { Medallion } from '@/design/motif';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const Email = z.string().trim().email();

export default function SignIn() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const send = async () => {
    const parsed = Email.safeParse(email);
    if (!parsed.success) return setError(tr('signin.invalid'));
    setError(null);
    setState('sending');
    const { error: err } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo: 'sezi://auth' } });
    if (err) {
      setState('idle');
      setError(tr('signin.error'));
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <View style={s.done}>
        <EmptyState
          icon={<Medallion primary={t.primary} accent={t.accent} ink={t.text} size={72} />}
          title={tr('signin.sent')}
          body={tr('signin.sentBody', { email: email.trim() })}
          action={<Button label={tr('common.close')} variant="ghost" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Medallion primary={t.primary} accent={t.accent} ink={t.text} size={72} />
        <Text style={[type.lead, { color: t.text }]}>{tr('signin.lead')}</Text>
        <Field
          label={tr('signin.email')}
          help={tr('signin.emailHelp')}
          error={error ?? undefined}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Button label={tr('signin.send')} onPress={send} disabled={state === 'sending'} />
        <Note text={tr('signin.why')} icon={<InfoIcon color={t.textMuted} />} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    done: { flex: 1, padding: space.lg, justifyContent: 'center', backgroundColor: t.background },
  });

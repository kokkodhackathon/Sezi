import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInputProps } from 'react-native';

import { Button, Field } from '@/components/ui';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { CODE_LENGTH, RESEND_SECONDS } from '@/lib/account';
import { useT } from '@/lib/i18n';

/** Hesap formlarının kabı: klavye açılınca içerik yukarı kayar, düğmeler dokunulabilir kalır. */
export function FormScreen({ lead, children }: { lead?: string; children: ReactNode }) {
  const t = useSweetTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {lead ? <Text style={[type.lead, { color: t.text }]}>{lead}</Text> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Şifre alanı: göster/gizle düğmesi (48 dp) ile; ekran okuyucu durumu duyar. */
export function PasswordField({ label, help, error, value, onChangeText, isNew, onSubmitEditing }: {
  label: string;
  help?: string;
  error?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Yeni şifre: parola yöneticisi güçlü şifre önerir. */
  isNew?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
}) {
  const { t: tr } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Field
        label={label}
        help={help}
        error={error}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        onSubmitEditing={onSubmitEditing}
      />
      <Button
        compact
        variant="ghost"
        style={{ alignSelf: 'flex-start', paddingHorizontal: space.sm }}
        label={visible ? tr('account.hide') : tr('account.show')}
        onPress={() => setVisible((v) => !v)}
      />
    </View>
  );
}

/** E-postadaki 6 haneli kod: yalnız rakam; telefon klavyesi ve otomatik doldurma kodu önerir. */
export function CodeField({ value, onChange, error, onComplete }: { value: string; onChange: (v: string) => void; error?: string; onComplete?: (code: string) => void }) {
  const { t: tr } = useT();
  return (
    <Field
      label={tr('account.code')}
      help={tr('account.codeHelp', { n: CODE_LENGTH })}
      error={error}
      value={value}
      onChangeText={(v) => {
        const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
        onChange(digits);
        if (digits.length === CODE_LENGTH) onComplete?.(digits);
      }}
      keyboardType="number-pad"
      maxLength={CODE_LENGTH}
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      autoFocus
    />
  );
}

/** Yeniden gönderme sayacı: sunucu aynı adrese dakikada bir kod gönderir. */
export function useCooldown(startActive = true) {
  const [left, setLeft] = useState(startActive ? RESEND_SECONDS : 0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, restart: () => setLeft(RESEND_SECONDS) };
}

const styles = StyleSheet.create({
  body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
});

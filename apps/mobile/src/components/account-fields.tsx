import { CODE_LENGTH, PASSWORD_MIN, RESEND_SECONDS } from '@sezi/shared';
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Field, RevealContext } from '@/components/ui';
import { CheckIcon, EyeIcon, InfoIcon, LockIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/** Odaklanan alanın altında da görünür kalacak pay (şifre kuralları, sıradaki düğme). */
const REVEAL_BELOW = 112;

/**
 * Hesap formlarının kabı. Klavye açılınca, klavyenin bu ekranı ne kadar örttüğü ölçülür (Android'de pencere
 * küçülmeyebilir: edge-to-edge); içerik o kadar alttan boşluk alır ve odaklanan alan altındaki payla birlikte
 * görünür alana kaydırılır. Alan değişince (İleri) de aynısı yapılır. Reduce motion'da kaydırma animasyonsuz.
 */
export function FormScreen({ lead, children }: { lead?: string; children: ReactNode }) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const frame = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const target = useRef<View | null>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [covered, setCovered] = useState(0);

  const bring = useCallback(() => {
    const v = target.current;
    const c = content.current;
    const f = frame.current;
    const top = keyboardTop.current;
    if (!v || !c || !f || top === null) return;
    f.measureInWindow((_fx, fy, _fw, fh) => {
      const hidden = Math.max(0, fy + fh - top);
      setCovered(hidden);
      const visible = fh - hidden;
      // Alt boşluk önce çizilsin; yoksa içerik kısa kalır ve kaydırma sınırda durur.
      setTimeout(() => {
        v.measureLayout(c, (_x, y, _w, h) => {
          const from = offset.current;
          let to = from;
          if (y + h + REVEAL_BELOW > from + visible) to = y + h + REVEAL_BELOW - visible;
          if (y - space.lg < to) to = Math.max(0, y - space.lg);
          if (to !== from) scroll.current?.scrollTo({ y: to, animated: !reduced });
        });
      }, 50);
    });
  }, [reduced]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      requestAnimationFrame(bring);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setCovered(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [bring]);

  const reveal = useCallback(
    (v: View) => {
      target.current = v;
      if (keyboardTop.current !== null) requestAnimationFrame(bring);
    },
    [bring],
  );

  return (
    <RevealContext.Provider value={reveal}>
      <View ref={frame} style={{ flex: 1, backgroundColor: t.background }} collapsable={false}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => (offset.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}>
          <View ref={content} collapsable={false} style={[styles.body, { paddingBottom: 56 + covered }]}>
            {lead ? <Text style={[type.lead, { color: t.textMuted }]}>{lead}</Text> : null}
            {children}
          </View>
        </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}

/** Şifre kuralları (sunucuyla aynı): yeni şifre yazılırken her biri ayrı ayrı işaretlenir. */
const RULES = [
  { key: 'account.ruleLength', ok: (p: string) => p.length >= PASSWORD_MIN },
  { key: 'account.ruleLetter', ok: (p: string) => /\p{L}/u.test(p) },
  { key: 'account.ruleDigit', ok: (p: string) => /\d/.test(p) },
] as const;

/**
 * Şifre alanı: sağda göz düğmesi (48 dp, durumunu duyurur). Yeni şifrede kurallar alanın altında
 * yazdıkça işaretlenir; işaret yalnız renk değil, simge ve "karşılandı" metniyle de verilir.
 */
export function PasswordField({ label, error, value, onChangeText, isNew, onSubmitEditing, inputRef }: {
  label: string;
  error?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Yeni şifre: parola yöneticisi güçlü şifre önerir, kurallar gösterilir. */
  isNew?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  inputRef?: RefObject<TextInput | null>;
}) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Field
        label={label}
        error={error}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        returnKeyType="go"
        placeholder={tr(isNew ? 'account.newPasswordPlaceholder' : 'account.passwordPlaceholder')}
        onSubmitEditing={onSubmitEditing}
        inputRef={inputRef}
        icon={(c) => <LockIcon color={c} />}
        trailing={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? tr('account.hide') : tr('account.show')}
            style={styles.eye}
            hitSlop={4}>
            <EyeIcon color={t.textMuted} off={!visible} />
          </Pressable>
        }
      />
      {isNew ? (
        <View style={{ gap: space.xs }}>
          {RULES.map((r) => {
            const ok = r.ok(value);
            return (
              <View key={r.key} style={styles.rule} accessible accessibilityLabel={`${tr(r.key)}${ok ? `, ${tr('account.ruleMet')}` : ''}`}>
                {ok ? <CheckIcon color={t.primaryText} size={18} /> : <View style={[styles.dot, { borderColor: t.textMuted }]} />}
                <Text style={[type.meta, { color: ok ? t.text : t.textMuted }]}>{tr(r.key)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * E-postadaki 6 haneli kod: altı kutu, tek gizli alan. Kutuların her biri bir rakam gösterir, sıradaki kutu
 * çerçeveyle işaretlenir. Telefon klavyesi ve otomatik doldurma kodu önerir; yapıştırma çalışır.
 */
export function CodeField({ value, onChange, error, onComplete }: { value: string; onChange: (v: string) => void; error?: string; onComplete?: (code: string) => void }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(true);
  const reveal = useContext(RevealContext);
  const box = useRef<View>(null);
  return (
    <View ref={box} style={{ gap: space.sm }} collapsable={false}>
      <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('account.code')}</Text>
      <Pressable onPress={() => ref.current?.focus()} accessible={false} style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const current = focused && i === Math.min(value.length, CODE_LENGTH - 1);
          return (
            <View
              key={i}
              style={[
                styles.codeBox,
                {
                  backgroundColor: current ? t.surface : t.soft,
                  borderColor: error ? t.danger : current ? t.primaryText : t.outlined ? t.border : t.soft,
                },
              ]}>
              <Text style={[type.display, { color: t.text, fontSize: 26, lineHeight: 32 }]}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
            onChange(digits);
            if (digits.length === CODE_LENGTH) onComplete?.(digits);
          }}
          onFocus={() => {
            setFocused(true);
            if (box.current) reveal?.(box.current);
          }}
          onBlur={() => setFocused(false)}
          accessibilityLabel={tr('account.code')}
          accessibilityHint={error ?? tr('account.codeHelp', { n: CODE_LENGTH })}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          autoFocus
          style={styles.codeInput}
        />
      </Pressable>
      {error ? (
        <View style={styles.rule} accessibilityLiveRegion="polite">
          <InfoIcon color={t.danger} size={18} />
          <Text style={[type.meta, { color: t.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : (
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('account.codeHelp', { n: CODE_LENGTH })}</Text>
      )}
    </View>
  );
}

/** Form genel hatası (sunucu, ağ): alanların altında, ikonla; ekran okuyucu hemen duyurur. */
export function FormError({ text }: { text?: string | null }) {
  const t = useSweetTheme();
  if (!text) return null;
  return (
    <View style={[styles.formError, { borderColor: t.danger }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <InfoIcon color={t.danger} size={20} />
      <Text style={[type.body, { color: t.danger, flex: 1 }]}>{text}</Text>
    </View>
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
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginHorizontal: 2 },
  codeRow: { flexDirection: 'row', gap: space.sm },
  codeBox: { flex: 1, height: 60, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  formError: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 2 },
  // Görünmez ama dokunulabilir ve odaklanabilir (Android otomatik doldurma görünür alan ister).
  codeInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});

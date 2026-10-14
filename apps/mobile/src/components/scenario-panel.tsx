import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import type { NavState } from '@/lib/sim/session';

/**
 * Jüri paneli: simülasyon sırasında gerçek hayat durumlarını canlı tetikler.
 * Yol kapatma ve yanlış dönüş yeniden rotayı, kalabalık ise duyu değişimini gösterir.
 */
export function ScenarioPanel({
  state,
  onBlock,
  onWrongTurn,
  onCrowd,
}: {
  state: NavState;
  onBlock: () => boolean;
  onWrongTurn: () => boolean;
  onCrowd: () => void;
}) {
  const t = useSeziTheme();
  const { t: tr } = useT();
  const [failed, setFailed] = useState(false);
  const run = (fn: () => boolean) => setFailed(!fn());
  const disabled = state.finished;

  const items = [
    { key: 'block', label: tr('sim.block'), hint: tr('sim.blockHint'), onPress: () => run(onBlock), active: false },
    { key: 'wrong', label: tr('sim.wrongTurn'), hint: tr('sim.wrongTurnHint'), onPress: () => run(onWrongTurn), active: state.detouring },
    { key: 'crowd', label: tr('sim.crowd'), hint: tr('sim.crowdHint'), onPress: () => { setFailed(false); onCrowd(); }, active: state.noisy, toggle: true },
  ];

  return (
    <View style={[styles.panel, { backgroundColor: t.soft }]}>
      <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">{tr('sim.scenarios')}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{tr('sim.scenariosBody')}</Text>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          disabled={disabled}
          accessibilityRole={it.toggle ? 'switch' : 'button'}
          accessibilityLabel={it.label}
          accessibilityHint={it.hint}
          accessibilityState={it.toggle ? { checked: it.active, disabled } : { disabled, busy: it.active }}
          style={({ pressed }) => [
            styles.item,
            { backgroundColor: it.active ? t.primary : t.surface },
            disabled && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[type.button, { color: it.active ? t.onPrimary : t.text }]}>{it.label}</Text>
          <Text style={[type.meta, { color: it.active ? t.onPrimary : t.textMuted }]}>{it.hint}</Text>
        </Pressable>
      ))}
      {failed ? <Text style={[type.meta, { color: t.danger }]} accessibilityLiveRegion="polite">{tr('sim.notApplicable')}</Text> : null}
      {state.reroutes > 0 || state.blocked.length > 0 ? (
        <Text style={[type.meta, { color: t.textMuted }]}>
          {[state.reroutes > 0 ? tr('sim.reroutes', { n: state.reroutes }) : null, state.blocked.length > 0 ? tr('sim.blockedCount', { n: state.blocked.length }) : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md, padding: space.lg, borderRadius: radius.xl },
  item: { gap: 2, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, justifyContent: 'center' },
});

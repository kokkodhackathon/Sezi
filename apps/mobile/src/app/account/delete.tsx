import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert, Text } from 'react-native';

import { FormScreen } from '@/components/account-fields';
import { Button, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { deleteAccount, errorKey } from '@/lib/account';
import { useT } from '@/lib/i18n';

/** Hesabı kalıcı silme: ne silinir, ne kalır açıkça yazılır; son adımda sistem onay penceresi. */
export default function DeleteAccount() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(tr('account.deleted'));
      router.dismissTo('/account');
    } catch (err) {
      setError(tr(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(tr('account.deleteAsk'), tr('account.deleteAskBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('account.deleteConfirm'), style: 'destructive', onPress: () => void run() },
    ]);

  return (
    <FormScreen lead={tr('account.deleteLead')}>
      <Note text={tr('account.deleteKeeps')} icon={<InfoIcon color={t.textMuted} />} />
      {error ? (
        <Text style={[type.body, { color: t.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button variant="danger" label={tr('account.deleteConfirm')} onPress={confirm} disabled={busy} />
      <Button variant="ghost" label={tr('common.cancel')} onPress={() => router.back()} />
    </FormScreen>
  );
}

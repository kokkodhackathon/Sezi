import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
import { Medallion } from '@/design/motif';
import { space } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const t = useSeziTheme();
  const { t: tr } = useT();
  return (
    <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', backgroundColor: t.background }}>
      <Stack.Screen options={{ title: '' }} />
      <EmptyState
        icon={<Medallion primary={t.primary} accent={t.accent} ink={t.text} size={80} />}
        title={tr('notFound.title')}
        body={tr('notFound.body')}
        action={<Button label={tr('notFound.home')} onPress={() => router.replace('/')} />}
      />
    </View>
  );
}

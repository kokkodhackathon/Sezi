import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
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
        title={tr('notFound.title')}
        body={tr('notFound.body')}
        action={<Button label={tr('notFound.home')} onPress={() => router.replace('/')} />}
      />
    </View>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/account-fields';
import { Button, Field } from '@/components/ui';
import { DisplayName, errorKey, NAME_MAX, useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';

export default function EditName() {
  const { t: tr } = useT();
  const { account, rename } = useAccount();
  const [name, setName] = useState(account?.display_name ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = DisplayName.safeParse(name);
    if (!n.success) return setError(tr('account.err.invalid_name', { n: NAME_MAX }));
    setError(undefined);
    setBusy(true);
    try {
      await rename(n.data);
      router.back();
    } catch (err) {
      setError(tr(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <Field
        label={tr('account.name')}
        help={tr('account.nameHelp')}
        error={error}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        maxLength={NAME_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Button label={tr('account.save')} onPress={save} disabled={busy || !account} />
    </FormScreen>
  );
}

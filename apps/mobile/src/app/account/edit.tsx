import { AVATAR_TONES, DisplayName, NAME_MAX, Username, USERNAME_MAX, USERNAME_MIN, type Identity } from '@sezi/shared';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, type TextInput, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { SeziLoader } from '@/components/sezi-loader';
import { Avatar } from '@/components/avatar';
import { Button, Field, SectionTitle } from '@/components/ui';
import { AtIcon, CameraIcon, CheckIcon, PersonIcon } from '@/design/icons';
import { SoftPressable } from '@/design/sweet/components';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { identityErrorKey, useIdentity } from '@/lib/identity';

type Errors = Partial<Record<'name' | 'username' | 'photo' | 'form', string>>;

/**
 * Profili düzenle: fotoğraf (galeri ya da kamera, hemen yüklenir), ad, @kullanıcı adı ve baş harf rengi.
 * Fotoğraf dışındakiler "Kaydet" ile tek istekte gider; önizleme yazdıkça güncellenir.
 */
export default function EditProfile() {
  const { t: tr } = useT();
  const { identity, avatar, save, setAvatar, removeAvatar } = useIdentity();
  if (!identity) {
    return (
      <FormScreen>
        <SeziLoader label={tr('account.loading')} />
      </FormScreen>
    );
  }
  return <Editor identity={identity} avatar={avatar} save={save} setAvatar={setAvatar} removeAvatar={removeAvatar} />;
}

function Editor({ identity, avatar, save, setAvatar, removeAvatar }: { identity: Identity } & Omit<ReturnType<typeof useIdentity>, 'identity' | 'loading'>) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [name, setName] = useState(identity.display_name);
  const [username, setUsername] = useState(identity.username ?? '');
  const [tone, setTone] = useState(identity.avatar_tone);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const usernameRef = useRef<TextInput>(null);

  const pick = async (source: 'library' | 'camera') => {
    setErrors({});
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setErrors({ photo: tr('account.photoNoPermission') });
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    setPhotoBusy(true);
    try {
      await setAvatar(asset.uri);
      AccessibilityInfo.announceForAccessibility(tr('account.photoSaved'));
    } catch (e) {
      setErrors({ photo: tr(identityErrorKey(e)) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const dropPhoto = async () => {
    setPhotoBusy(true);
    try {
      await removeAvatar();
      AccessibilityInfo.announceForAccessibility(tr('account.photoRemoved'));
    } catch (e) {
      setErrors({ photo: tr(identityErrorKey(e)) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    const n = DisplayName.safeParse(name);
    // Kullanıcı adı isteğe bağlı: boş bırakılırsa kaldırılır.
    const uname = username.trim();
    const u = Username.safeParse(uname);
    const usernameOk = !uname || u.success;
    const next: Errors = {
      name: n.success ? undefined : tr('account.err.invalid_name', { n: NAME_MAX }),
      username: usernameOk ? undefined : tr('account.err.invalid_username', { min: USERNAME_MIN, max: USERNAME_MAX }),
    };
    setErrors(next);
    if (!n.success || !usernameOk) return;
    setBusy(true);
    try {
      await save({ display_name: n.data, username: uname ? (u.data ?? null) : null, avatar_tone: tone });
      AccessibilityInfo.announceForAccessibility(tr('account.profileSaved'));
      router.back();
    } catch (e) {
      const key = identityErrorKey(e);
      setErrors(key === 'account.err.username_taken' ? { username: tr(key) } : { form: tr(key) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <View style={styles.photo}>
        <Avatar identity={{ display_name: name || identity.display_name, avatar_tone: tone }} source={avatar} size={112} />
        {photoBusy ? <SeziLoader size={24} label={tr('account.photoUploading')} /> : null}
        <View style={styles.photoActions}>
          <Button compact variant="secondary" label={tr('account.photoPick')} onPress={() => void pick('library')} disabled={photoBusy} />
          <Button compact variant="secondary" icon={(c) => <CameraIcon color={c} />} label={tr('account.photoTake')} onPress={() => void pick('camera')} disabled={photoBusy} />
        </View>
        {identity.avatar_path ? <Button compact variant="ghost" label={tr('account.photoRemove')} onPress={() => void dropPhoto()} disabled={photoBusy} /> : null}
        <FormError text={errors.photo} />
      </View>

      <Field
        label={tr('account.name')}
        placeholder={tr('account.namePlaceholder')}
        help={tr('account.nameHelp')}
        error={errors.name}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        maxLength={NAME_MAX}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => usernameRef.current?.focus()}
        icon={(c) => <PersonIcon color={c} size={20} />}
      />
      <Field
        inputRef={usernameRef}
        label={tr('account.username')}
        placeholder={tr('account.usernamePlaceholder')}
        help={tr('account.usernameHelp', { min: USERNAME_MIN, max: USERNAME_MAX })}
        error={errors.username}
        value={username}
        onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        maxLength={USERNAME_MAX}
        returnKeyType="done"
        icon={(c) => <AtIcon color={c} />}
      />

      <View style={{ gap: space.md }}>
        <SectionTitle title={tr('account.tone')} />
        <View style={styles.tones} accessibilityRole="radiogroup" accessibilityLabel={tr('account.tone')}>
          {AVATAR_TONES.map((k) => {
            const on = tone === k;
            const tn = t.tones[k];
            return (
              <SoftPressable
                key={k}
                onPress={() => setTone(k)}
                accessibilityRole="radio"
                accessibilityLabel={tr(`account.tone.${k}`)}
                accessibilityState={{ checked: on }}
                style={[styles.swatch, { backgroundColor: tn.fill, borderColor: on ? t.text : t.outlined ? t.border : tn.fill }]}>
                {on ? <CheckIcon color={tn.ink} size={22} /> : null}
              </SoftPressable>
            );
          })}
        </View>
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('account.toneHelp', { tone: tr(`account.tone.${tone}`) })}</Text>
      </View>

      <FormError text={errors.form} />
      <Button label={busy ? tr('account.saving') : tr('account.save')} onPress={submit} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', gap: space.md },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  tones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});

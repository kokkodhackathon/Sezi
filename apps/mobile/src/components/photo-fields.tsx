import { PHOTO_ALT_MAX, PHOTO_CAPTION_MAX, type UserPhoto, type Visibility } from '@sezi/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { photoStatus, VisibilityChoice } from '@/components/social-visuals';
import { Button, Card, Field, ToggleRow } from '@/components/ui';
import { ArchiveIcon, GlobeIcon } from '@/design/icons';
import { outline, SweetSheet } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

export interface PhotoFieldsValue {
  altText: string;
  caption: string;
  visibility: Visibility;
  suggestArchive: boolean;
}

/**
 * Fotoğraf alanları: alt metin, (katlanmış) açıklama, simgeli görünürlük, arşiv önerisi.
 * Uzun izin metni yalnız "Ayrıntı" panelinde; ekranda tek kısa satır.
 */
export function PhotoFields({
  value,
  onChange,
  accepted = false,
  disabled = false,
}: {
  value: PhotoFieldsValue;
  onChange: (value: PhotoFieldsValue) => void;
  accepted?: boolean;
  disabled?: boolean;
}) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [captionOpen, setCaptionOpen] = useState(!!value.caption);
  const [licenseOpen, setLicenseOpen] = useState(false);
  return (
    // collapsable={false}: pointerEvents değişince Fabric bu görünümü düzleştirip geri açmasın;
    // kaydırma alanında yeniden ekleme "child already has a parent" çökmesine yol açıyor.
    <View
      collapsable={false}
      style={{ gap: space.lg }}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityState={{ disabled }}>
      <Field
        label={tr('photos.alt')}
        help={tr('photos.altHelp')}
        value={value.altText}
        onChangeText={(altText) => onChange({ ...value, altText })}
        maxLength={PHOTO_ALT_MAX}
        multiline
        editable={!disabled}
      />
      {captionOpen ? (
        <Field
          label={tr('photos.caption')}
          value={value.caption}
          onChangeText={(caption) => onChange({ ...value, caption })}
          maxLength={PHOTO_CAPTION_MAX}
          multiline
          editable={!disabled}
        />
      ) : (
        <View style={{ alignItems: 'flex-start' }}>
          <Button variant="ghost" compact label={tr('photos.addCaption')} onPress={() => setCaptionOpen(true)} />
        </View>
      )}
      <View style={{ gap: space.sm }}>
        <Text style={[type.cardTitle, { color: t.text }]} accessibilityRole="header">
          {tr('photos.visibility')}
        </Text>
        <VisibilityChoice
          label={tr('photos.visibility')}
          value={value.visibility}
          onChange={(visibility) => onChange({ ...value, visibility })}
          labels={{ private: tr('photos.vis.private'), friends: tr('photos.vis.friends'), public: tr('photos.vis.public') }}
        />
        {value.visibility === 'public' ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <GlobeIcon color={t.textMuted} size={16} />
            <Text style={[type.meta, { color: t.textMuted, flex: 1 }]}>{tr('photos.publicShort')}</Text>
          </View>
        ) : null}
      </View>
      <Card padded={false}>
        {accepted ? (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg }} accessible>
            <ArchiveIcon color={t.primaryText} />
            <Text style={[type.itemTitle, { color: t.text, flex: 1 }]}>{tr('photos.archive.accepted')}</Text>
          </View>
        ) : (
          <ToggleRow
            first
            icon={(c) => <ArchiveIcon color={c} />}
            title={tr('photos.suggest')}
            subtitle={value.suggestArchive ? tr('photos.archiveShort') : undefined}
            value={value.suggestArchive}
            onChange={(suggestArchive) => onChange({ ...value, suggestArchive })}
          />
        )}
        {value.suggestArchive || accepted ? (
          <View style={{ paddingHorizontal: space.sm, paddingBottom: space.sm, alignItems: 'flex-start' }}>
            <Button variant="ghost" compact label={tr('photos.archiveMore')} onPress={() => setLicenseOpen(true)} />
          </View>
        ) : null}
      </Card>
      <SweetSheet visible={licenseOpen} onClose={() => setLicenseOpen(false)} title={tr('photos.suggest')}>
        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          <Text style={[type.body, { color: t.text }]}>{tr('photos.archiveNote')}</Text>
          {accepted ? <Text style={[type.body, { color: t.text }]}>{tr('photos.archiveAccepted')}</Text> : null}
        </View>
      </SweetSheet>
    </View>
  );
}

/** Fotoğraf durumu: simge + kısa sözcük (ayrıntı ekranında). */
export function PhotoStatus({ photo }: { photo: UserPhoto }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {photoStatus(photo, tr).map(({ icon: I, label }) => (
        <View
          key={label}
          accessible
          accessibilityLabel={label}
          style={[
            { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.sm },
            { backgroundColor: t.soft },
            outline(t),
          ]}>
          <I color={photo.review === 'rejected' && photo.visibility === 'public' ? t.danger : t.text} size={16} />
          <Text style={[type.bubble, { color: t.text }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

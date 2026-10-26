import { PHOTO_ALT_MAX, PHOTO_CAPTION_MAX, type UserPhoto, type Visibility } from '@sezi/shared';
import { View } from 'react-native';

import { Badge, Field, Note, Segmented, ToggleRow } from '@/components/ui';
import { space } from '@/design/type';
import { useT } from '@/lib/i18n';

export interface PhotoFieldsValue {
  altText: string;
  caption: string;
  visibility: Visibility;
  suggestArchive: boolean;
}

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
  const { t: tr } = useT();
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
      <Field
        label={tr('photos.caption')}
        value={value.caption}
        onChangeText={(caption) => onChange({ ...value, caption })}
        maxLength={PHOTO_CAPTION_MAX}
        multiline
        editable={!disabled}
      />
      <Segmented<Visibility>
        label={tr('photos.visibility')}
        value={value.visibility}
        onChange={(visibility) => onChange({ ...value, visibility })}
        options={[
          { value: 'private', label: tr('photos.vis.private') },
          { value: 'friends', label: tr('photos.vis.friends') },
          { value: 'public', label: tr('photos.vis.public') },
        ]}
      />
      {value.visibility === 'public' ? <Note text={tr('photos.publicNote')} /> : null}
      {accepted ? (
        <Note text={tr('photos.archiveAccepted')} />
      ) : (
        <ToggleRow
          first
          title={tr('photos.suggest')}
          value={value.suggestArchive}
          onChange={(suggestArchive) => onChange({ ...value, suggestArchive })}
        />
      )}
      {value.suggestArchive || accepted ? <Note text={tr('photos.archiveNote')} /> : null}
    </View>
  );
}

export function PhotoStatus({ photo }: { photo: UserPhoto }) {
  const { t: tr } = useT();
  const label =
    photo.visibility === 'public'
      ? `${tr('photos.vis.public')} · ${tr(`photos.review.${photo.review}`)}`
      : tr(`photos.vis.${photo.visibility}`);
  return (
    <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
      <Badge label={label} tone={photo.review === 'rejected' ? 'danger' : 'neutral'} />
      {photo.archive !== 'none' ? <Badge label={tr(`photos.archive.${photo.archive}`)} /> : null}
    </View>
  );
}

import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from 'twenty-shared/types';

export const canBeRequired = (
  field: Pick<FieldMetadataItem, 'type' | 'isCustom'>,
) => {
  if (field.isCustom === false) {
    return false;
  }

  return ![
    FieldMetadataType.ACTOR,
    FieldMetadataType.MORPH_RELATION,
    FieldMetadataType.POSITION,
    FieldMetadataType.RELATION,
    FieldMetadataType.TS_VECTOR,
  ].includes(field.type);
};

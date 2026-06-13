import { Controller, useFormContext } from 'react-hook-form';

import { useFieldMetadataItemById } from '@/object-metadata/hooks/useFieldMetadataItemById';
import { Separator } from '@/settings/components/Separator';
import { SettingsOptionCardContentSelect } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { canBeRequired } from '@/settings/data-model/fields/forms/utils/canBeRequired';
import { t } from '@lingui/core/macro';
import { type FieldMetadataType } from 'twenty-shared/types';
import { IconAlertCircle } from 'twenty-ui/display';
import { Toggle } from 'twenty-ui/input';

type SettingsDataModelFieldIsRequiredFormValues = {
  isNullable: boolean;
};

type SettingsDataModelFieldIsRequiredFormProps = {
  fieldType: FieldMetadataType;
  existingFieldMetadataId: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  separatorAfter?: boolean;
  fallbackSeparator?: boolean;
};

export const SettingsDataModelFieldIsRequiredForm = ({
  fieldType,
  existingFieldMetadataId,
  disabled = false,
  separatorBefore = false,
  separatorAfter = false,
  fallbackSeparator = false,
}: SettingsDataModelFieldIsRequiredFormProps) => {
  const { control } =
    useFormContext<SettingsDataModelFieldIsRequiredFormValues>();

  const { fieldMetadataItem } = useFieldMetadataItemById(
    existingFieldMetadataId,
  );

  const isCreationMode = existingFieldMetadataId === '';

  if (
    isCreationMode ||
    !canBeRequired({
      type: fieldType,
      isCustom: fieldMetadataItem?.isCustom ?? true,
    })
  ) {
    return fallbackSeparator ? <Separator /> : null;
  }

  return (
    <>
      {separatorBefore ? <Separator /> : null}
      <Controller
        name="isNullable"
        defaultValue={fieldMetadataItem?.isNullable ?? true}
        control={control}
        render={({ field: { onChange, value } }) => {
          const isRequired = value === false;

          return (
            <SettingsOptionCardContentSelect
              Icon={IconAlertCircle}
              title={t`Required`}
              description={t`Require a value before records can be saved`}
            >
              <Toggle
                toggleSize="small"
                value={isRequired}
                onChange={(required) => onChange(!required)}
                disabled={disabled}
              />
            </SettingsOptionCardContentSelect>
          );
        }}
      />
      {separatorAfter ? <Separator /> : null}
    </>
  );
};

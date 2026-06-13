type FieldMetadataRequiredInfo = {
  isNullable?: boolean | null;
  settings?: unknown;
};

const hasRequiredSetting = (settings: unknown) => {
  if (typeof settings !== 'object' || settings === null) {
    return false;
  }

  return (settings as { isRequired?: unknown }).isRequired === true;
};

export const isFieldMetadataRequired = (
  fieldMetadata: FieldMetadataRequiredInfo | null | undefined,
) =>
  fieldMetadata?.isNullable === false ||
  hasRequiredSetting(fieldMetadata?.settings);

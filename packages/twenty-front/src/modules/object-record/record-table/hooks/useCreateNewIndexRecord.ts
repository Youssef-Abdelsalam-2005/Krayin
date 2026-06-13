import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { formatFieldMetadataItemAsFieldDefinition } from '@/object-metadata/utils/formatFieldMetadataItemAsFieldDefinition';
import { getLabelIdentifierFieldMetadataItem } from '@/object-metadata/utils/getLabelIdentifierFieldMetadataItem';
import { useBuildRecordInputFromRLSPredicates } from '@/object-record/hooks/useBuildRecordInputFromRLSPredicates';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { recordGroupDefinitionsComponentSelector } from '@/object-record/record-group/states/selectors/recordGroupDefinitionsComponentSelector';
import { recordIndexGroupFieldMetadataItemComponentState } from '@/object-record/record-index/states/recordIndexGroupFieldMetadataComponentState';
import { recordIndexOpenRecordInState } from '@/object-record/record-index/states/recordIndexOpenRecordInState';
import { recordIndexRecordIdsByGroupComponentFamilyState } from '@/object-record/record-index/states/recordIndexRecordIdsByGroupComponentFamilyState';
import { useUpsertRecordsInStore } from '@/object-record/record-store/hooks/useUpsertRecordsInStore';
import { useBuildRecordInputFromFilters } from '@/object-record/record-table/hooks/useBuildRecordInputFromFilters';
import { isFieldValueEmpty } from '@/object-record/record-field/ui/utils/isFieldValueEmpty';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { canOpenObjectInSidePanel } from '@/object-record/utils/canOpenObjectInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomComponentFamilyStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentFamilyStateCallbackState';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { ViewOpenRecordIn } from '~/generated-metadata/graphql';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { AppPath } from 'twenty-shared/types';
import { findByProperty, isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';
import { t } from '@lingui/core/macro';
import { useNavigateApp } from '~/hooks/useNavigateApp';

type UseCreateNewIndexRecordProps = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  instanceId?: string;
};

export const useCreateNewIndexRecord = ({
  objectMetadataItem,
  instanceId,
}: UseCreateNewIndexRecordProps) => {
  const recordGroupDefinitions = useAtomComponentSelectorValue(
    recordGroupDefinitionsComponentSelector,
    instanceId,
  );

  const store = useStore();
  const recordIndexRecordIdsByGroupCallbackState =
    useAtomComponentFamilyStateCallbackState(
      recordIndexRecordIdsByGroupComponentFamilyState,
      instanceId,
    );

  const recordIndexGroupFieldMetadataItem = useAtomComponentStateValue(
    recordIndexGroupFieldMetadataItemComponentState,
    instanceId,
  );

  const { openRecordInSidePanel } = useOpenRecordInSidePanel();

  const { closeSidePanelMenu } = useSidePanelMenu();

  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
    shouldMatchRootQueryFilter: true,
  });

  const { upsertRecordsInStore } = useUpsertRecordsInStore();
  const { enqueueErrorSnackBar } = useSnackBar();

  const navigate = useNavigateApp();

  const { buildRecordInputFromFilters } = useBuildRecordInputFromFilters({
    objectMetadataItem,
    instanceId,
  });

  const { buildRecordInputFromRLSPredicates } =
    useBuildRecordInputFromRLSPredicates({
      objectMetadataItem,
    });

  const createNewIndexRecord = useCallback(
    async (recordInput?: Partial<ObjectRecord>) => {
      const recordId = v4();
      const recordInputFromRLSPredicates = buildRecordInputFromRLSPredicates();
      const recordInputFromFilters = buildRecordInputFromFilters();

      const mergedRecordInput = {
        ...recordInputFromRLSPredicates,
        ...recordInputFromFilters,
        ...recordInput,
      };

      const missingRequiredField = objectMetadataItem.fields.find((field) => {
        if (
          field.isNullable !== false ||
          isDefined(field.defaultValue) ||
          field.isUIReadOnly
        ) {
          return false;
        }

        const fieldDefinition = formatFieldMetadataItemAsFieldDefinition({
          field,
          objectMetadataItem,
        });

        return isFieldValueEmpty({
          fieldDefinition,
          fieldValue: mergedRecordInput[field.name],
        });
      });

      if (isDefined(missingRequiredField)) {
        enqueueErrorSnackBar({
          message: t`Fill required fields before creating this record.`,
        });

        return;
      }

      const recordIndexOpenRecordIn = store.get(
        recordIndexOpenRecordInState.atom,
      );

      const createdRecord = await createOneRecord({
        id: recordId,
        ...mergedRecordInput,
      });

      if (
        recordIndexOpenRecordIn === ViewOpenRecordIn.SIDE_PANEL &&
        canOpenObjectInSidePanel(objectMetadataItem.nameSingular)
      ) {
        openRecordInSidePanel({
          recordId,
          objectNameSingular: objectMetadataItem.nameSingular,
          isNewRecord: true,
        });
      } else {
        const labelIdentifierFieldMetadataItem =
          getLabelIdentifierFieldMetadataItem(objectMetadataItem);

        closeSidePanelMenu();
        navigate(
          AppPath.RecordShowPage,
          {
            objectNameSingular: objectMetadataItem.nameSingular,
            objectRecordId: recordId,
          },
          undefined,
          {
            state: {
              isNewRecord: true,
              objectRecordId: recordId,
              labelIdentifierFieldName: labelIdentifierFieldMetadataItem?.name,
            },
          },
        );
      }

      if (isDefined(recordIndexGroupFieldMetadataItem)) {
        const recordGroup = recordGroupDefinitions.find(
          findByProperty(
            'value',
            createdRecord[recordIndexGroupFieldMetadataItem.name],
          ),
        );

        if (isDefined(recordGroup)) {
          const currentRecordIds = store.get(
            recordIndexRecordIdsByGroupCallbackState(recordGroup.id),
          );

          if (recordInput?.position === 'first') {
            const newRecordIds = [createdRecord.id, ...currentRecordIds];

            store.set(
              recordIndexRecordIdsByGroupCallbackState(recordGroup.id),
              newRecordIds,
            );
          } else {
            const newRecordIds = [...currentRecordIds, createdRecord.id];

            store.set(
              recordIndexRecordIdsByGroupCallbackState(recordGroup.id),
              newRecordIds,
            );
          }
        }
      }

      upsertRecordsInStore({ partialRecords: [createdRecord] });

      return createdRecord;
    },
    [
      store,
      buildRecordInputFromRLSPredicates,
      buildRecordInputFromFilters,
      createOneRecord,
      enqueueErrorSnackBar,
      navigate,
      objectMetadataItem,
      openRecordInSidePanel,
      recordGroupDefinitions,
      recordIndexGroupFieldMetadataItem,
      recordIndexRecordIdsByGroupCallbackState,
      upsertRecordsInStore,
      closeSidePanelMenu,
    ],
  );

  return {
    createNewIndexRecord,
  };
};

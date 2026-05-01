/**
 * Per-object configuration for record-change notifications.
 *
 * Two knobs:
 *   - `notifiableUpdateFields`: only fire RECORD_UPDATED notifications when
 *     at least one of these fields appears in the event's `updatedFields`.
 *     Avoids spamming users every time someone's avatar URL is recomputed.
 *   - `displayNameField`: which field on the record holds the human-readable
 *     name we cache into `linkedRecordCachedName`.
 *
 * Object names match Twenty's standard `nameSingular` (see
 * STANDARD_OBJECTS in twenty-shared/src/metadata/constants/standard-object.constant.ts).
 *
 * If an object isn't listed here it produces NO notifications — keeps the
 * blast radius small until we explicitly opt each one in.
 */
export const NOTIFIABLE_OBJECT_CONFIG: Record<
  string,
  { notifiableUpdateFields: string[]; displayNameField: string }
> = {
  opportunity: {
    notifiableUpdateFields: [
      'name',
      'stage',
      'amount',
      'closeDate',
      'pointOfContactId',
      'companyId',
      // `owner` is a relation to workspaceMember; the FK column is `ownerId`
      'ownerId',
    ],
    displayNameField: 'name',
  },
  task: {
    notifiableUpdateFields: ['title', 'status', 'dueAt', 'assigneeId'],
    displayNameField: 'title',
  },
  person: {
    notifiableUpdateFields: ['name', 'companyId', 'jobTitle'],
    displayNameField: 'name',
  },
  company: {
    notifiableUpdateFields: ['name', 'accountOwnerId'],
    displayNameField: 'name',
  },
  note: {
    notifiableUpdateFields: ['title'],
    displayNameField: 'title',
  },
};

/**
 * Field name on a Task that holds the assignee FK.  Used by the assignment-
 * detection logic in the event listener and by the reminder cron.
 */
export const TASK_ASSIGNEE_FIELD = 'assigneeId';

export const isNotifiableObject = (objectName: string): boolean =>
  Object.prototype.hasOwnProperty.call(NOTIFIABLE_OBJECT_CONFIG, objectName);

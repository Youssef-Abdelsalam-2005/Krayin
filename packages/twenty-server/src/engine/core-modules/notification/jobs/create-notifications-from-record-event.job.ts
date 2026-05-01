import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';
import {
  ObjectRecordCreateEvent,
  ObjectRecordDeleteEvent,
  type ObjectRecordNonDestructiveEvent,
  ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { NotificationService } from 'src/engine/core-modules/notification/services/notification.service';
import {
  NOTIFIABLE_OBJECT_CONFIG,
  TASK_ASSIGNEE_FIELD,
  isNotifiableObject,
} from 'src/engine/core-modules/notification/constants/notification-trigger-rules.constant';
import { NotificationType } from 'src/engine/core-modules/notification/types/notification-type.enum';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { parseEventNameOrThrow } from 'src/engine/workspace-event-emitter/utils/parse-event-name';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

import { type CreateNotificationInput } from 'src/engine/core-modules/notification/services/notification.service';

/**
 * Listens to the same `entityEventsToDbQueue` that already feeds
 * TimelineActivity (see UpsertTimelineActivityFromInternalEvent) and turns
 * relevant CRUD events into per-recipient Notification rows.
 *
 * Recipient policy (per spec):
 *   - opportunity / person / company / note → ALL workspace members
 *   - task                                  → the assignee only
 *   - excludes the actor in every case
 *
 * Field gating:
 *   - CREATE always fires (subject to the policy above)
 *   - UPDATE only fires when at least one updated field is in the per-object
 *     allow-list (NOTIFIABLE_OBJECT_CONFIG.notifiableUpdateFields)
 *   - DELETE always fires
 *
 * Special casing:
 *   - When a Task gets a new `assigneeId` (CREATE-with-assignee or UPDATE that
 *     changes assigneeId), the new assignee gets a TASK_ASSIGNED instead of
 *     a generic RECORD_UPDATED.
 */
@Processor(MessageQueue.entityEventsToDbQueue)
@Injectable()
export class CreateNotificationsFromRecordEventJob {
  private readonly logger = new Logger(
    CreateNotificationsFromRecordEventJob.name,
  );

  constructor(
    private readonly notificationService: NotificationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @Process(CreateNotificationsFromRecordEventJob.name)
  async handle(
    workspaceEventBatch: WorkspaceEventBatch<ObjectRecordNonDestructiveEvent>,
  ): Promise<void> {
    if (workspaceEventBatch.events.length === 0) return;

    const { workspaceId, objectMetadata, name } = workspaceEventBatch;
    const { objectSingularName, action } = parseEventNameOrThrow(name);

    if (objectMetadata.isSystem) return;
    if (!isNotifiableObject(objectSingularName)) return;

    const config = NOTIFIABLE_OBJECT_CONFIG[objectSingularName];

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        // Resolve the actor's workspaceMemberId for every event in the batch.
        const workspaceMemberRepo =
          await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            WorkspaceMemberWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        const actorUserIds = workspaceEventBatch.events
          .map((e) => e.userId)
          .filter(isDefined);

        const actorMembers = actorUserIds.length
          ? await workspaceMemberRepo.findBy({ userId: In(actorUserIds) })
          : [];

        const actorMemberIdByUserId = new Map<string, string>(
          actorMembers.map((m) => [m.userId, m.id]),
        );

        // Recipients: for "everyone" objects, fetch all members once.
        const allMemberIds =
          objectSingularName === 'task'
            ? [] // task uses per-event assignee resolution
            : (
                await workspaceMemberRepo.find({ select: ['id'] })
              ).map((m) => m.id);

        const inserts: CreateNotificationInput[] = [];

        for (const event of workspaceEventBatch.events) {
          const actorMemberId = event.workspaceMemberId
            ?? (event.userId
              ? actorMemberIdByUserId.get(event.userId)
              : undefined)
            ?? null;

          const linkedRecordCachedName =
            this.extractDisplayName(event, config.displayNameField) ?? null;

          const baseFields = {
            workspaceId,
            triggeredByWorkspaceMemberId: actorMemberId,
            linkedObjectName: objectSingularName,
            linkedRecordId: event.recordId,
            linkedRecordCachedName,
          };

          if (action === 'created' && event instanceof ObjectRecordCreateEvent) {
            inserts.push(
              ...this.buildCreateNotifications({
                event,
                baseFields,
                actorMemberId,
                allMemberIds,
                objectSingularName,
              }),
            );
            continue;
          }

          if (action === 'updated' && event instanceof ObjectRecordUpdateEvent) {
            inserts.push(
              ...this.buildUpdateNotifications({
                event,
                baseFields,
                actorMemberId,
                allMemberIds,
                config,
                objectSingularName,
              }),
            );
            continue;
          }

          if (action === 'deleted' && event instanceof ObjectRecordDeleteEvent) {
            const recipients =
              objectSingularName === 'task'
                ? this.getTaskRecipientIds(event, actorMemberId)
                : this.excludeActor(allMemberIds, actorMemberId);

            for (const recipientId of recipients) {
              inserts.push({
                ...baseFields,
                recipientWorkspaceMemberId: recipientId,
                type: NotificationType.RECORD_DELETED,
                properties: { before: event.properties.before ?? null },
              });
            }
          }
        }

        if (inserts.length === 0) return;

        try {
          await this.notificationService.createMany(inserts);
        } catch (err) {
          this.logger.warn(
            `Failed to insert ${inserts.length} notifications for ` +
              `workspace=${workspaceId} object=${objectSingularName}: ${
                (err as Error).message
              }`,
          );
        }
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  // ---------------------------------------------------------------------------
  // CREATE-event payload builders
  // ---------------------------------------------------------------------------

  private buildCreateNotifications(args: {
    event: ObjectRecordCreateEvent;
    baseFields: Omit<
      CreateNotificationInput,
      'recipientWorkspaceMemberId' | 'type' | 'properties'
    >;
    actorMemberId: string | null;
    allMemberIds: string[];
    objectSingularName: string;
  }): CreateNotificationInput[] {
    const { event, baseFields, actorMemberId, allMemberIds, objectSingularName } =
      args;

    if (objectSingularName === 'task') {
      const assigneeId = this.extractAssignee(event.properties.after);

      if (!assigneeId || assigneeId === actorMemberId) return [];

      return [
        {
          ...baseFields,
          recipientWorkspaceMemberId: assigneeId,
          type: NotificationType.TASK_ASSIGNED,
          properties: {
            after: event.properties.after,
          },
        },
      ];
    }

    return this.excludeActor(allMemberIds, actorMemberId).map((recipientId) => ({
      ...baseFields,
      recipientWorkspaceMemberId: recipientId,
      type: NotificationType.RECORD_CREATED,
      properties: { after: event.properties.after },
    }));
  }

  // ---------------------------------------------------------------------------
  // UPDATE-event payload builders
  // ---------------------------------------------------------------------------

  private buildUpdateNotifications(args: {
    event: ObjectRecordUpdateEvent;
    baseFields: Omit<
      CreateNotificationInput,
      'recipientWorkspaceMemberId' | 'type' | 'properties'
    >;
    actorMemberId: string | null;
    allMemberIds: string[];
    config: { notifiableUpdateFields: string[] };
    objectSingularName: string;
  }): CreateNotificationInput[] {
    const {
      event,
      baseFields,
      actorMemberId,
      allMemberIds,
      config,
      objectSingularName,
    } = args;

    const updatedFields = event.properties.updatedFields ?? [];
    const meaningfulChanges = updatedFields.filter((f) =>
      config.notifiableUpdateFields.includes(f),
    );

    if (meaningfulChanges.length === 0) return [];

    const updateProperties = {
      changedFields: meaningfulChanges,
      diff: event.properties.diff ?? null,
      before: event.properties.before ?? null,
      after: event.properties.after ?? null,
    };

    if (objectSingularName === 'task') {
      const out: CreateNotificationInput[] = [];

      const newAssignee = this.extractAssignee(event.properties.after);
      const oldAssignee = this.extractAssignee(event.properties.before);

      // Special case: assignee changed → TASK_ASSIGNED to the NEW assignee,
      // overriding what would otherwise be a RECORD_UPDATED.
      if (
        meaningfulChanges.includes(TASK_ASSIGNEE_FIELD) &&
        newAssignee &&
        newAssignee !== oldAssignee &&
        newAssignee !== actorMemberId
      ) {
        out.push({
          ...baseFields,
          recipientWorkspaceMemberId: newAssignee,
          type: NotificationType.TASK_ASSIGNED,
          properties: updateProperties,
        });
      }

      // Generic RECORD_UPDATED for the (possibly newly-set) assignee, only if
      // there are non-assignment changes too (or no assignment change at all).
      const nonAssignmentChanges = meaningfulChanges.filter(
        (f) => f !== TASK_ASSIGNEE_FIELD,
      );

      if (
        nonAssignmentChanges.length > 0 &&
        newAssignee &&
        newAssignee !== actorMemberId &&
        // avoid double-notification for a brand-new assignee — TASK_ASSIGNED already covers them
        !(
          meaningfulChanges.includes(TASK_ASSIGNEE_FIELD) &&
          newAssignee !== oldAssignee
        )
      ) {
        out.push({
          ...baseFields,
          recipientWorkspaceMemberId: newAssignee,
          type: NotificationType.RECORD_UPDATED,
          properties: updateProperties,
        });
      }

      return out;
    }

    return this.excludeActor(allMemberIds, actorMemberId).map((recipientId) => ({
      ...baseFields,
      recipientWorkspaceMemberId: recipientId,
      type: NotificationType.RECORD_UPDATED,
      properties: updateProperties,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getTaskRecipientIds(
    event: ObjectRecordDeleteEvent,
    actorMemberId: string | null,
  ): string[] {
    const assigneeId = this.extractAssignee(event.properties.before);

    if (!assigneeId || assigneeId === actorMemberId) return [];

    return [assigneeId];
  }

  private excludeActor(
    memberIds: string[],
    actorMemberId: string | null,
  ): string[] {
    if (!actorMemberId) return memberIds;

    return memberIds.filter((id) => id !== actorMemberId);
  }

  private extractAssignee(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const v = (payload as Record<string, unknown>)[TASK_ASSIGNEE_FIELD];

    return typeof v === 'string' ? v : null;
  }

  private extractDisplayName(
    event: ObjectRecordNonDestructiveEvent,
    field: string,
  ): string | null {
    const source =
      ('after' in event.properties ? event.properties.after : null) ??
      ('before' in event.properties ? event.properties.before : null);

    if (!source || typeof source !== 'object') return null;

    const v = (source as Record<string, unknown>)[field];

    if (typeof v === 'string') return v;
    // Some "name" fields are composites (e.g. person.name = { firstName, lastName })
    if (v && typeof v === 'object') {
      const composite = Object.values(v as Record<string, unknown>)
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ')
        .trim();

      return composite.length > 0 ? composite : null;
    }

    return null;
  }
}

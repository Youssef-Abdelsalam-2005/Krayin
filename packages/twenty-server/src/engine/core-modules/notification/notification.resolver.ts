import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query } from '@nestjs/graphql';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { NotificationEntity } from 'src/engine/core-modules/notification/notification.entity';
import {
  ArchiveNotificationsInput,
  ListNotificationsInput,
  MarkNotificationsAsReadInput,
  NotificationCountsDTO,
} from 'src/engine/core-modules/notification/dtos/notification.dto';
import { NotificationService } from 'src/engine/core-modules/notification/services/notification.service';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@MetadataResolver(() => NotificationEntity)
@UseGuards(WorkspaceAuthGuard)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  @Query(() => [NotificationEntity])
  async notifications(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
    @Args('input', { type: () => ListNotificationsInput, nullable: true })
    input?: ListNotificationsInput,
  ): Promise<NotificationEntity[]> {
    return this.notificationService.list(
      workspace.id,
      workspaceMemberId,
      input ?? {},
    );
  }

  @Query(() => NotificationCountsDTO)
  async notificationCounts(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
  ): Promise<NotificationCountsDTO> {
    return this.notificationService.getCounts(workspace.id, workspaceMemberId);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /** Returns the number of rows affected. */
  @Mutation(() => Int)
  async markNotificationsAsRead(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
    @Args('input', { type: () => MarkNotificationsAsReadInput, nullable: true })
    input?: MarkNotificationsAsReadInput,
  ): Promise<number> {
    return this.notificationService.markAsRead(
      workspace.id,
      workspaceMemberId,
      input ?? {},
    );
  }

  @Mutation(() => Int)
  async archiveNotifications(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
    @Args('input', { type: () => ArchiveNotificationsInput })
    input: ArchiveNotificationsInput,
  ): Promise<number> {
    return this.notificationService.archive(
      workspace.id,
      workspaceMemberId,
      input,
    );
  }
}

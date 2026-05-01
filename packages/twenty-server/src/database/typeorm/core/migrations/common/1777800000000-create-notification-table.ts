import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationTable1777800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."notification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "recipientWorkspaceMemberId" uuid NOT NULL,
        "type" varchar(64) NOT NULL,
        "properties" jsonb,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "archivedAt" TIMESTAMP WITH TIME ZONE,
        "linkedObjectName" varchar(128),
        "linkedRecordId" uuid,
        "linkedRecordCachedName" text,
        "triggeredByWorkspaceMemberId" uuid,
        "reminderWindowDays" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_workspace"
          FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_NOTIFICATION_WORKSPACE_RECIPIENT_CREATED"
         ON "core"."notification" ("workspaceId", "recipientWorkspaceMemberId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_NOTIFICATION_WORKSPACE_RECIPIENT_READ"
         ON "core"."notification" ("workspaceId", "recipientWorkspaceMemberId", "readAt")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_NOTIFICATION_LINKED_RECORD"
         ON "core"."notification" ("workspaceId", "linkedObjectName", "linkedRecordId")`,
    );

    // Partial unique index used by the daily task-reminder cron to make the
    // upsert idempotent — guarantees we don't insert a 2nd "due in 2 days"
    // row for the same task on the same day.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_NOTIFICATION_REMINDER_DEDUP_UNIQUE"
        ON "core"."notification"
          ("workspaceId", "recipientWorkspaceMemberId", "type", "linkedRecordId", "reminderWindowDays")
        WHERE "type" IN ('TASK_DUE_SOON', 'TASK_OVERDUE') AND "linkedRecordId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_NOTIFICATION_REMINDER_DEDUP_UNIQUE"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_NOTIFICATION_LINKED_RECORD"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_NOTIFICATION_WORKSPACE_RECIPIENT_READ"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_NOTIFICATION_WORKSPACE_RECIPIENT_CREATED"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."notification"`);
  }
}

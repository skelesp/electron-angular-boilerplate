import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1788506430536 implements MigrationInterface {
  name = 'Migration1788506430536';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "note_record" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "content" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "note_record"`);
  }
}

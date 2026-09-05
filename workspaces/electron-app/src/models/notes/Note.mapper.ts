import { NoteDto } from '@electron-angular-boilerplate/shared';
import { NoteRecord } from './Note.entity';

/**
 * Converts the persistence entity to the DTO the contract declares.
 *
 * Explicit field-by-field, on purpose. `NoteRecord` and `NoteDto` happen to have the same
 * shape today, so returning the entity straight from a handler type-checks - and then the
 * first `@Column()` someone adds for internal bookkeeping (a soft-delete flag, an owner
 * id, a moderation note) is shipped to the renderer by a handler nobody edited. Listing
 * the fields means adding a column is inert until someone decides to expose it, and the
 * compiler flags the DTO fields you forgot.
 *
 * Every domain should have one of these. The output validation in `wrapHandler` is the
 * backstop for when it doesn't; this is the fix.
 */
export function toNoteDto(record: NoteRecord): NoteDto {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

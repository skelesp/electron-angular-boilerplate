import { z } from 'zod';
import { apiResponseSchema } from '../types';

// Example domain entity, mirrored by electron-app's NoteRecord TypeORM
// entity. Named NoteDto (rather than Note) to avoid colliding with that
// entity's name - the two are not the same type and are not kept in sync
// automatically.
export const NoteDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type NoteDto = z.infer<typeof NoteDtoSchema>;

export const CreateNoteInputSchema = z
  .object({
    title: z.string().min(1),
    content: z.string(),
  })
  .strict();
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const CreateNoteOutputSchema = apiResponseSchema(NoteDtoSchema);
export type CreateNoteOutput = z.infer<typeof CreateNoteOutputSchema>;

export const GetNoteInputSchema = z
  .object({
    id: z.string(),
  })
  .strict();
export type GetNoteInput = z.infer<typeof GetNoteInputSchema>;

export const GetNoteOutputSchema = apiResponseSchema(NoteDtoSchema);
export type GetNoteOutput = z.infer<typeof GetNoteOutputSchema>;

// No input: typed as z.undefined() rather than z.object({}), since the TS
// type `{}` means "anything but null/undefined" and would silently accept
// (and Zod's default object mode would silently strip) unrelated fields.
export const ListNotesInputSchema = z.undefined();
export type ListNotesInput = z.infer<typeof ListNotesInputSchema>;

export const ListNotesOutputSchema = apiResponseSchema(z.array(NoteDtoSchema));
export type ListNotesOutput = z.infer<typeof ListNotesOutputSchema>;

export const DeleteNoteInputSchema = z
  .object({
    id: z.string(),
  })
  .strict();
export type DeleteNoteInput = z.infer<typeof DeleteNoteInputSchema>;

export const DeleteNoteOutputSchema = apiResponseSchema(z.object({ id: z.string() }));
export type DeleteNoteOutput = z.infer<typeof DeleteNoteOutputSchema>;

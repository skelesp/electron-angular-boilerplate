import { InferEndpoints } from '../types.js';
import {
  CreateNoteInputSchema,
  CreateNoteOutputSchema,
  GetNoteInputSchema,
  GetNoteOutputSchema,
  ListNotesInputSchema,
  ListNotesOutputSchema,
  DeleteNoteInputSchema,
  DeleteNoteOutputSchema,
} from './types.js';

export const noteApiName = 'note';

export const noteEndpoints = {
  create: {
    channel: `${noteApiName}.create` as const,
    inputSchema: CreateNoteInputSchema,
    outputSchema: CreateNoteOutputSchema,
  },
  get: {
    channel: `${noteApiName}.get` as const,
    inputSchema: GetNoteInputSchema,
    outputSchema: GetNoteOutputSchema,
  },
  list: {
    channel: `${noteApiName}.list` as const,
    inputSchema: ListNotesInputSchema,
    outputSchema: ListNotesOutputSchema,
  },
  delete: {
    channel: `${noteApiName}.delete` as const,
    inputSchema: DeleteNoteInputSchema,
    outputSchema: DeleteNoteOutputSchema,
  },
} as const;

export type NoteApiEndpoints = InferEndpoints<typeof noteEndpoints>;

import {
  ApiError,
  ApiErrorCode,
  CreateNoteInput,
  CreateNoteOutput,
  GetNoteInput,
  GetNoteOutput,
  ListNotesOutput,
  DeleteNoteInput,
  DeleteNoteOutput,
  NoteApiEndpoints,
  Handlers,
  noteEndpoints,
} from '@electron-angular-boilerplate/shared';
import { getDataSource } from '../../database/sqlite.config';
import { NoteRepository } from './Note.repository';
import { toNoteDto } from './Note.mapper';

class NoteHandler {
  /**
   * Resolved per call rather than in the constructor. `noteHandlers` below is built at
   * module load, and a constructor that reached for the DataSource would mean importing
   * this file required a live database - which is what used to force every handler spec
   * to mock `sqlite.config` out entirely. Building a repository is just wrapping an
   * entity manager, so doing it per call costs nothing.
   */
  private get notes(): NoteRepository {
    return new NoteRepository(getDataSource());
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteOutput> {
    const repository = this.notes;
    const note = await repository.save(repository.create(input));
    return { status: 'success', data: toNoteDto(note) };
  }

  async getNote(input: GetNoteInput): Promise<GetNoteOutput> {
    const note = await this.notes.findOne({ where: { id: input.id } });
    if (!note) {
      // A named code, not a thrown bare Error: "you asked for something that isn't there"
      // is part of this endpoint's contract, and the renderer can branch on it.
      throw new ApiError(ApiErrorCode.NOT_FOUND, 'Note not found');
    }
    return { status: 'success', data: toNoteDto(note) };
  }

  async listNotes(): Promise<ListNotesOutput> {
    const notes = await this.notes.findAllOrderedByCreatedAt();
    return {
      status: 'success',
      data: notes.map(toNoteDto),
      meta: { totalItems: notes.length },
    };
  }

  async deleteNote(input: DeleteNoteInput): Promise<DeleteNoteOutput> {
    const result = await this.notes.delete({ id: input.id });
    if (!result.affected) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, 'Note not found');
    }
    return { status: 'success', data: { id: input.id } };
  }
}

const noteHandler = new NoteHandler();
export const noteHandlers: Handlers<NoteApiEndpoints> = {
  [noteEndpoints.create.channel]: noteHandler.createNote.bind(noteHandler),
  [noteEndpoints.get.channel]: noteHandler.getNote.bind(noteHandler),
  [noteEndpoints.list.channel]: noteHandler.listNotes.bind(noteHandler),
  [noteEndpoints.delete.channel]: noteHandler.deleteNote.bind(noteHandler),
} as const;

import {
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
import { AppDataSource } from '../../database/sqlite.config';
import { NoteRepository } from './Note.repository';

class NoteHandler {
  private noteRepository: NoteRepository;

  constructor() {
    this.noteRepository = new NoteRepository(AppDataSource);
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteOutput> {
    const note = await this.noteRepository.save(this.noteRepository.create(input));
    return { status: 'success', data: note };
  }

  async getNote(input: GetNoteInput): Promise<GetNoteOutput> {
    const note = await this.noteRepository.findOne({ where: { id: input.id } });
    if (!note) {
      throw new Error('Note not found');
    }
    return { status: 'success', data: note };
  }

  async listNotes(): Promise<ListNotesOutput> {
    const notes = await this.noteRepository.findAllOrderedByCreatedAt();
    return {
      status: 'success',
      data: notes,
      meta: { totalItems: notes.length },
    };
  }

  async deleteNote(input: DeleteNoteInput): Promise<DeleteNoteOutput> {
    const result = await this.noteRepository.delete({ id: input.id });
    if (!result.affected) {
      throw new Error('Note not found');
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

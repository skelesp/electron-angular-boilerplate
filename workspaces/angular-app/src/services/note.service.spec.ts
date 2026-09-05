import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NoteService } from './note.service';
import { ElectronService } from './electron.service';
import { ApiErrorCode, apiRegistry, eventRegistry, NoteDto } from '@electron-angular-boilerplate/shared';

describe('NoteService', () => {
  let service: NoteService;
  let invoke: ReturnType<typeof vi.fn>;
  let on: ReturnType<typeof vi.fn>;
  let unsubscribe: ReturnType<typeof vi.fn>;
  // Captured from the `on` call so a test can play the part of the main process and push
  // an event, the same way the real preload bridge would.
  let emit: (payload: unknown) => void;

  const note: NoteDto = {
    id: '1',
    title: 'Groceries',
    content: 'Milk, eggs',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    invoke = vi.fn();
    unsubscribe = vi.fn();
    emit = () => undefined;
    on = vi.fn((_channel: string, listener: (payload: unknown) => void) => {
      emit = listener;
      return unsubscribe;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ElectronService, useValue: { invoke, on } }],
    });
  });

  it('loadNotes populates notes$ on a successful response', async () => {
    invoke.mockResolvedValue({ status: 'success', data: [note], meta: { totalItems: 1 } });

    service = TestBed.inject(NoteService);
    await service.loadNotes();

    expect(service.notes$()).toEqual([note]);
    expect(service.error$()).toBeUndefined();
  });

  it('loadNotes sets error$ on an error-status response', async () => {
    invoke.mockResolvedValue({ status: 'error', error: { code: ApiErrorCode.INTERNAL, details: 'boom' } });

    service = TestBed.inject(NoteService);
    await service.loadNotes();

    expect(service.error$()).toBe('boom');
  });

  it('subscribes to the note.changed event on construction', () => {
    invoke.mockResolvedValue({ status: 'success', data: [], meta: { totalItems: 0 } });

    service = TestBed.inject(NoteService);

    expect(on).toHaveBeenCalledWith(eventRegistry.note.changed.channel, expect.any(Function));
  });

  it('reloads when the main process reports that notes changed', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [], meta: { totalItems: 0 } }); // initial load
    service = TestBed.inject(NoteService);
    await vi.waitFor(() => expect(service.notes$()).toEqual([]));

    invoke.mockResolvedValueOnce({ status: 'success', data: [note], meta: { totalItems: 1 } });
    emit({ reason: 'created', id: note.id });

    await vi.waitFor(() => expect(service.notes$()).toEqual([note]));
  });

  it('create calls invoke with the note channel and payload', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [], meta: { totalItems: 0 } }); // initial load
    service = TestBed.inject(NoteService);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());

    invoke.mockResolvedValueOnce({ status: 'success', data: note });

    const result = await service.create('Groceries', 'Milk, eggs');

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.create.channel, {
      title: 'Groceries',
      content: 'Milk, eggs',
    });
    expect(result).toEqual(note);
    // create() no longer reloads by itself - the note.changed event is what refreshes the
    // list, so the mutation path stays the same whoever triggered the change.
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('remove calls invoke with the note id', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [note], meta: { totalItems: 1 } }); // initial load
    service = TestBed.inject(NoteService);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());

    invoke.mockResolvedValueOnce({ status: 'success', data: { id: note.id } });

    const result = await service.remove(note.id);

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.delete.channel, { id: note.id });
    expect(result).toEqual({ id: note.id });
  });

  it('surfaces a NOT_FOUND delete as an error rather than a throw', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [note], meta: { totalItems: 1 } }); // initial load
    service = TestBed.inject(NoteService);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());

    invoke.mockResolvedValueOnce({
      status: 'error',
      error: { code: ApiErrorCode.NOT_FOUND, details: 'Note not found' },
    });

    expect(await service.remove('gone')).toBe('error');
    expect(service.error$()).toBe('Note not found');
  });
});

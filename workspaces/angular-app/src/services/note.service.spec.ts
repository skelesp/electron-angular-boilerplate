import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NoteService } from './note.service';
import { ElectronService } from './electron.service';
import { apiRegistry, NoteDto } from '@electron-angular-boilerplate/shared';

describe('NoteService', () => {
  let service: NoteService;
  let invoke: ReturnType<typeof vi.fn>;

  const note: NoteDto = {
    id: '1',
    title: 'Groceries',
    content: 'Milk, eggs',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    invoke = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ElectronService, useValue: { invoke } }],
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
    invoke.mockResolvedValue({ status: 'error', error: { code: 500, details: 'boom' } });

    service = TestBed.inject(NoteService);
    await service.loadNotes();

    expect(service.error$()).toBe('boom');
  });

  it('create calls invoke with the note channel and payload, then reloads', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [], meta: { totalItems: 0 } }); // initial loadNotes() in the constructor
    service = TestBed.inject(NoteService);
    await Promise.resolve();

    invoke.mockResolvedValueOnce({ status: 'success', data: note });
    invoke.mockResolvedValueOnce({ status: 'success', data: [note], meta: { totalItems: 1 } }); // reload after create

    const result = await service.create('Groceries', 'Milk, eggs');

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.create.channel, {
      title: 'Groceries',
      content: 'Milk, eggs',
    });
    expect(result).toEqual(note);
    expect(service.notes$()).toEqual([note]);
  });

  it('remove calls invoke with the note id, then reloads', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: [note], meta: { totalItems: 1 } }); // initial loadNotes() in the constructor
    service = TestBed.inject(NoteService);
    await Promise.resolve();

    invoke.mockResolvedValueOnce({ status: 'success', data: { id: note.id } });
    invoke.mockResolvedValueOnce({ status: 'success', data: [], meta: { totalItems: 0 } }); // reload after remove

    const result = await service.remove(note.id);

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.delete.channel, { id: note.id });
    expect(result).toEqual({ id: note.id });
    expect(service.notes$()).toEqual([]);
  });
});

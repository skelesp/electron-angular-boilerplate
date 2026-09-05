import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { apiRegistry, NoteDto } from '@electron-angular-boilerplate/shared';
import { ElectronService } from '../../services/electron.service';
import { NotesComponent } from './notes.component';

// Faked at the bridge rather than at NoteService, so this exercises the real service the
// component actually talks to - a stub of NoteService would only prove the stub works.
describe('NotesComponent', () => {
  let fixture: ComponentFixture<NotesComponent>;
  let component: NotesComponent;
  let invoke: ReturnType<typeof vi.fn>;

  const note: NoteDto = {
    id: '1',
    title: 'Groceries',
    content: 'Milk, eggs',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    invoke = vi.fn().mockResolvedValue({ status: 'success', data: [note], meta: { totalItems: 1 } });

    await TestBed.configureTestingModule({
      imports: [NotesComponent],
      providers: [{ provide: ElectronService, useValue: { invoke, on: () => () => undefined } }],
    }).compileComponents();

    fixture = TestBed.createComponent(NotesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders the notes the main process returned', () => {
    expect(text()).toContain('Groceries');
    expect(fixture.nativeElement.querySelectorAll('.note')).toHaveLength(1);
  });

  it('binds the inputs two-way to the signals holding the draft note', async () => {
    const input = fixture.nativeElement.querySelector('input[placeholder="Title"]') as HTMLInputElement;
    input.value = 'Typed';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(component.title()).toBe('Typed');
  });

  it('creates a note from the form fields and clears them', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: note });

    component.title.set('Shopping');
    component.content.set('Bread');
    await component.createNote();

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.create.channel, {
      title: 'Shopping',
      content: 'Bread',
    });
    expect(component.title()).toBe('');
    expect(component.content()).toBe('');
  });

  it('refuses to create a note without a title', async () => {
    invoke.mockClear();

    await component.createNote();

    expect(invoke).not.toHaveBeenCalled();
  });

  it('deletes through the service', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: { id: note.id } });

    await component.deleteNote(note.id);

    expect(invoke).toHaveBeenCalledWith(apiRegistry.note.delete.channel, { id: note.id });
  });

  it('shows the empty state when there are no notes', async () => {
    invoke.mockResolvedValue({ status: 'success', data: [], meta: { totalItems: 0 } });
    component.noteService.reload();
    await fixture.whenStable();

    expect(text()).toContain('No notes yet.');
  });
});

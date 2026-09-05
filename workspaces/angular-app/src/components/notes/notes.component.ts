import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../services/note.service';

/**
 * The reference consumer of the shared API contract: it creates, lists and deletes notes
 * through `NoteService`, and never touches `window.electronAPI` itself.
 *
 * Nothing here reloads the list after a write. `NoteService` subscribes to the main
 * process's `note.changed` event and reloads on that instead, so this component renders
 * the same way whether the change came from its own button or from another window.
 */
@Component({
  selector: 'app-notes',
  imports: [FormsModule],
  template: `<div class="notes">
    <h2>Notes (electron -> shared contract -> sqlite -> angular)</h2>

    <section>
      <input [(ngModel)]="title" placeholder="Title" />
      <input [(ngModel)]="content" placeholder="Content" />
      <button (click)="createNote()">Add note</button>
    </section>

    <section>
      @for (note of noteService.notes(); track note.id) {
        <div class="note">
          <strong>{{ note.title }}</strong> - {{ note.content }}
          <button (click)="deleteNote(note.id)">Delete</button>
        </div>
      } @empty {
        <p class="status">{{ noteService.loading() ? 'Loading notes...' : 'No notes yet.' }}</p>
      }
    </section>

    @if (noteService.error(); as error) {
      <section class="error">{{ error }}</section>
    }
  </div>`,
  styles: `
    .note {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.25rem;
    }
    .status {
      opacity: 0.7;
    }
    .error {
      color: light-dark(#ba1a1a, #ffb4ab);
    }
  `,
})
export class NotesComponent {
  readonly noteService = inject(NoteService);

  // Signals rather than plain fields, so the template's two-way bindings stay readable
  // under zoneless change detection: writing one marks the view dirty by itself.
  readonly title = signal('');
  readonly content = signal('');

  async createNote() {
    if (!this.title()) {
      return;
    }
    await this.noteService.create(this.title(), this.content());
    this.title.set('');
    this.content.set('');
  }

  async deleteNote(id: string) {
    await this.noteService.remove(id);
  }
}

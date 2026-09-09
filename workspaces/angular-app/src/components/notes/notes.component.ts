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

    <!--
      Each input is wrapped in its own <label> rather than paired through for/id: a component
      template can be instantiated more than once on a page, and duplicated ids would silently
      point every label at the first copy. A placeholder is a hint, not a name - it vanishes
      the moment you type - so it is not a substitute for the label.

      A real <form> rather than a bare button: it gets Enter-to-submit for nothing, which is
      what a keyboard user reaches for after filling the second field.
    -->
    <form class="composer" (ngSubmit)="createNote()">
      <label class="field">
        <span>Title</span>
        <input name="title" [(ngModel)]="title" placeholder="Title" />
      </label>
      <label class="field">
        <span>Content</span>
        <input name="content" [(ngModel)]="content" placeholder="Content" />
      </label>
      <button type="submit">Add note</button>
    </form>

    <ul class="note-list">
      @for (note of noteService.notes(); track note.id) {
        <li class="note">
          <strong>{{ note.title }}</strong> - {{ note.content }}
          <!--
            Every row's button reads "Delete" on screen, which is fine when you can see which
            row it sits in and useless when you are hearing a list of buttons. aria-label names
            the target; the visible text stays short.
          -->
          <button type="button" [attr.aria-label]="'Delete ' + note.title" (click)="deleteNote(note.id)">Delete</button>
        </li>
      } @empty {
        <li class="status">{{ noteService.loading() ? 'Loading notes...' : 'No notes yet.' }}</li>
      }
    </ul>

    @if (noteService.error(); as error) {
      <p class="error" role="alert">{{ error }}</p>
    }
  </div>`,
  styles: `
    .composer {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .note-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
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

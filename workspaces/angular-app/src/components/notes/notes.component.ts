import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [FormsModule, MatIconModule],
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
            An icon-only button, which is only safe because aria-label names the target: on
            screen you can see which row it sits in, but a screen reader would otherwise read a
            list of identical "Delete" buttons. <mat-icon> is aria-hidden by default, so the
            ligature text doesn't reach the accessible name.

            This is also the template that keeps the bundled Material Icons font honest. The
            font ships for the sake of <mat-icon>, and if nothing rendered one, a build that
            dropped or mis-subset it would look perfectly fine - see the e2e note-flow spec,
            which asserts this glyph actually rasterizes in the packaged app.
          -->
          <button class="delete" type="button" [attr.aria-label]="'Delete ' + note.title" (click)="deleteNote(note.id)">
            <mat-icon>delete</mat-icon>
          </button>
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
    /* Sized to the glyph: <mat-icon> is a 24px box, so the button is that plus padding. */
    .delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      line-height: 0;
      cursor: pointer;
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

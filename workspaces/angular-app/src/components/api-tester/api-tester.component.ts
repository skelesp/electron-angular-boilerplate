import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../services/note.service';

@Component({
  selector: 'app-api-tester',
  imports: [JsonPipe, FormsModule],
  template: `<div class="container">
    <h2>Notes (electron -> shared contract -> sqlite -> angular)</h2>

    <section>
      <input [(ngModel)]="title" placeholder="Title" />
      <input [(ngModel)]="content" placeholder="Content" />
      <button (click)="createNote()">Add note</button>
    </section>

    <section>
      @for (note of noteService.notes$(); track note.id) {
        <div class="note">
          <strong>{{ note.title }}</strong> - {{ note.content }}
          <button (click)="deleteNote(note.id)">Delete</button>
        </div>
      }
    </section>

    @if (noteService.error$()) {
      <section class="error">
        <pre>{{ noteService.error$() | json }}</pre>
      </section>
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
    .error {
      color: red;
    }
  `,
})
export class ApiTesterComponent {
  noteService = inject(NoteService);

  title = '';
  content = '';

  async createNote() {
    if (!this.title) {
      return;
    }
    await this.noteService.create(this.title, this.content);
    this.title = '';
    this.content = '';
  }

  async deleteNote(id: string) {
    await this.noteService.remove(id);
  }
}

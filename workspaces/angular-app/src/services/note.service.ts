import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ElectronService } from './electron.service';
import { apiRegistry, eventRegistry, NoteDto } from '@electron-angular-boilerplate/shared';

@Injectable({
  providedIn: 'root',
})
export class NoteService {
  private electronService = inject(ElectronService);
  private destroyRef = inject(DestroyRef);

  // Private signals for internal state management
  #notes = signal<NoteDto[]>([]);
  #loading = signal(true);
  #error = signal<string | undefined>(undefined);

  // Public readonly signals for components to consume
  readonly notes$ = this.#notes.asReadonly();
  readonly loading$ = this.#loading.asReadonly();
  readonly error$ = this.#error.asReadonly();

  constructor() {
    // The cached list is kept fresh by the main process telling us it changed, rather
    // than by each mutation method remembering to reload afterwards. That covers changes
    // this service didn't cause - another window, a background job, a migration - which
    // a reload-after-my-own-write never can.
    const unsubscribe = this.electronService.on(eventRegistry.note.changed.channel, () => {
      void this.loadNotes();
    });
    this.destroyRef.onDestroy(unsubscribe);

    this.loadNotes(); // Initial load
  }

  async loadNotes() {
    this.#loading.set(true);
    this.#error.set(undefined);

    try {
      const response = await this.electronService.invoke(apiRegistry.note.list.channel, undefined);
      if (response.status === 'success') {
        this.#notes.set(response.data);
      } else {
        this.#error.set(response.error.details);
      }
    } catch (err) {
      this.#error.set('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      this.#loading.set(false);
    }
  }

  async create(title: string, content: string): Promise<'error' | NoteDto> {
    try {
      const response = await this.electronService.invoke(apiRegistry.note.create.channel, {
        title,
        content,
      });

      if (response.status === 'success') {
        // No reload here: the handler emits `note.changed`, and the subscription above
        // refreshes the list.
        return response.data;
      } else {
        this.#error.set(response.error.details);
        return response.status;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      this.#error.set(errorMessage);
      throw err;
    }
  }

  async remove(id: string): Promise<'error' | { id: string }> {
    try {
      const response = await this.electronService.invoke(apiRegistry.note.delete.channel, { id });

      if (response.status === 'success') {
        return response.data;
      } else {
        // A deleted-in-another-window note comes back as NOT_FOUND rather than a generic
        // failure, so the renderer can tell "already gone" from "something broke".
        this.#error.set(response.error.details);
        return response.status;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      this.#error.set(errorMessage);
      throw err;
    }
  }
}

import { computed, DestroyRef, inject, Injectable, resource, signal } from '@angular/core';
import { ElectronService } from './electron.service';
import { apiRegistry, eventRegistry, NoteDto } from '@electron-angular-boilerplate/shared';

@Injectable({
  providedIn: 'root',
})
export class NoteService {
  private readonly electronService = inject(ElectronService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The list itself, owned by a `resource`: it runs the loader once when the service is
   * created, tracks its own loading and error state, and exposes a single `reload()` for
   * the subscription below to call.
   *
   * The alternative - a constructor that fires off a `loadNotes()` and a hand-rolled
   * loading/error signal pair - is the shape this used to have, and it made construction
   * itself an async side effect that every consumer (specs included) had to know about.
   */
  readonly #notes = resource({
    loader: async () => {
      const response = await this.electronService.invoke(apiRegistry.note.list.channel, undefined);
      if (response.status === 'error') {
        // Thrown rather than stored: the resource's own error state is the single place a
        // failed list lives, and `error` below reads it back out.
        throw new Error(response.error.details);
      }
      return response.data;
    },
    defaultValue: [],
  });

  /** Errors from create/remove, which are not part of the list resource's own lifecycle. */
  readonly #mutationError = signal<string | undefined>(undefined);

  // Public readonly signals for components to consume. No `$` suffix: that conventionally
  // means an Observable, and reading one of these is a synchronous call, not a subscription.
  readonly notes = computed(() => (this.#notes.hasValue() ? this.#notes.value() : []));
  readonly loading = this.#notes.isLoading;
  readonly error = computed(() => this.#mutationError() ?? this.#notes.error()?.message);

  constructor() {
    // The cached list is kept fresh by the main process telling us it changed, rather
    // than by each mutation method remembering to reload afterwards. That covers changes
    // this service didn't cause - another window, a background job, a migration - which
    // a reload-after-my-own-write never can.
    const unsubscribe = this.electronService.on(eventRegistry.note.changed.channel, () => {
      this.#notes.reload();
    });
    this.destroyRef.onDestroy(unsubscribe);
  }

  /** Re-read the list. Rarely needed by hand - `note.changed` already triggers this. */
  reload(): void {
    this.#notes.reload();
  }

  async create(title: string, content: string): Promise<'error' | NoteDto> {
    this.#mutationError.set(undefined);

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
        this.#mutationError.set(response.error.details);
        return response.status;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      this.#mutationError.set(errorMessage);
      throw err;
    }
  }

  async remove(id: string): Promise<'error' | { id: string }> {
    this.#mutationError.set(undefined);

    try {
      const response = await this.electronService.invoke(apiRegistry.note.delete.channel, { id });

      if (response.status === 'success') {
        return response.data;
      } else {
        // A deleted-in-another-window note comes back as NOT_FOUND rather than a generic
        // failure, so the renderer can tell "already gone" from "something broke".
        this.#mutationError.set(response.error.details);
        return response.status;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      this.#mutationError.set(errorMessage);
      throw err;
    }
  }
}

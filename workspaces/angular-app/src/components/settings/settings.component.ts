import { Component, inject } from '@angular/core';
import { ThemeSource } from '@electron-angular-boilerplate/shared';
import { ThemeService } from '../../services/theme.service';

/**
 * The lazily loaded route (see app.routes.ts), and the consumer of the `theme` domain -
 * the half of the contract that has no database behind it at all: the main process reads
 * and writes Electron's `nativeTheme`, and pushes `theme.changed` when the OS switches.
 */
@Component({
  selector: 'app-settings',
  template: `<div class="settings">
    <h2>Appearance</h2>

    <div class="sources">
      @for (option of sources; track option) {
        <button type="button" [class.selected]="themeService.source() === option" (click)="select(option)">
          {{ option }}
        </button>
      }
    </div>

    <p class="status">
      Following {{ themeService.source() === 'system' ? 'your operating system' : 'this override' }}: currently painting
      {{ themeService.isDark() ? 'dark' : 'light' }}. Flip your OS dark-mode setting with 'system' selected and this
      updates without a reload - the main process pushes the change.
    </p>
  </div>`,
  styles: `
    .sources {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .sources button {
      text-transform: capitalize;
    }
    .sources button.selected {
      font-weight: 600;
      outline: 2px solid currentColor;
    }
    .status {
      max-width: 40rem;
      margin: 0 auto;
      opacity: 0.8;
    }
  `,
})
export class SettingsComponent {
  readonly themeService = inject(ThemeService);

  readonly sources: readonly ThemeSource[] = ['system', 'light', 'dark'];

  select(source: ThemeSource) {
    void this.themeService.setSource(source);
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { apiRegistry, ThemeState } from '@electron-angular-boilerplate/shared';
import { ElectronService } from '../../services/electron.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let invoke: ReturnType<typeof vi.fn>;

  const system: ThemeState = { source: 'system', shouldUseDarkColors: false };

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(async () => {
    invoke = vi.fn().mockResolvedValue({ status: 'success', data: system });

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [{ provide: ElectronService, useValue: { invoke, on: () => () => undefined } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
  });

  it('offers the three theme sources and marks the active one', () => {
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['system', 'light', 'dark']);
    expect(buttons().filter((button) => button.classList.contains('selected'))).toHaveLength(1);
  });

  it('sends the chosen source to the main process and reflects the answer', async () => {
    invoke.mockResolvedValueOnce({ status: 'success', data: { source: 'dark', shouldUseDarkColors: true } });

    buttons()[2].click();
    await fixture.whenStable();

    expect(invoke).toHaveBeenCalledWith(apiRegistry.theme.setSource.channel, { source: 'dark' });
    expect(fixture.nativeElement.textContent).toContain('painting dark');
  });
});

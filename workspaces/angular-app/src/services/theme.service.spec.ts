import { ApplicationRef, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { apiRegistry, eventRegistry, ThemeState } from '@electron-angular-boilerplate/shared';
import { ElectronService } from './electron.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let invoke: ReturnType<typeof vi.fn>;
  let on: ReturnType<typeof vi.fn>;
  let emit: (payload: ThemeState) => void;

  const dark: ThemeState = { source: 'system', shouldUseDarkColors: true };

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const colorScheme = () => TestBed.inject(DOCUMENT).documentElement.style.colorScheme;

  beforeEach(() => {
    invoke = vi.fn().mockResolvedValue({ status: 'success', data: dark });
    emit = () => undefined;
    on = vi.fn((_channel: string, listener: (payload: ThemeState) => void) => {
      emit = listener;
      return () => undefined;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ElectronService, useValue: { invoke, on } }],
    });
  });

  it('asks the main process what the theme is and reflects it on the document', async () => {
    service = TestBed.inject(ThemeService);
    await settle();

    expect(invoke).toHaveBeenCalledWith(apiRegistry.theme.get.channel, undefined);
    expect(service.isDark()).toBe(true);
    expect(colorScheme()).toBe('dark');
  });

  it('follows a theme.changed push without asking again', async () => {
    service = TestBed.inject(ThemeService);
    await settle();
    expect(on).toHaveBeenCalledWith(eventRegistry.theme.changed.channel, expect.any(Function));
    invoke.mockClear();

    emit({ source: 'system', shouldUseDarkColors: false });
    await settle();

    expect(service.isDark()).toBe(false);
    expect(colorScheme()).toBe('light');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('setSource writes through and adopts the state the main process answers with', async () => {
    service = TestBed.inject(ThemeService);
    await settle();

    invoke.mockResolvedValueOnce({ status: 'success', data: { source: 'light', shouldUseDarkColors: false } });
    await service.setSource('light');
    await settle();

    expect(invoke).toHaveBeenCalledWith(apiRegistry.theme.setSource.channel, { source: 'light' });
    expect(service.source()).toBe('light');
    expect(colorScheme()).toBe('light');
  });

  it('falls back to what the browser itself reports when there is no Electron bridge', async () => {
    invoke.mockRejectedValue(new Error('not running inside Electron'));

    service = TestBed.inject(ThemeService);
    await settle();

    // jsdom reports no dark-mode preference; the point is that a failed lookup leaves a
    // usable theme rather than an exception or a blank screen.
    expect(service.source()).toBe('system');
    expect(service.isDark()).toBe(false);
  });
});

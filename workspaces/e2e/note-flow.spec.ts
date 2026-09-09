import { test, expect, type Locator } from '@playwright/test';
import { launchPackagedApp } from './launchPackagedApp';

// Runs against the packaged app (not `localhost:4200`), specifically because bugs like a
// sandboxed preload script failing to resolve a dependency, or a CSP blocking something the
// dev server never enforces, only show up once app.isPackaged is true - a dev-mode test
// wouldn't catch them. Requires `npm run package -- --dir` to have already run (see root
// package.json's "test:e2e" script, which does both in order).
//
// It also covers the main -> renderer event path by construction: NoteService never reloads
// after its own mutations, so the list can only change because the main process emitted
// `note.changed` and the preload bridge delivered it.
test('creating and deleting a note round-trips through IPC to SQLite and back', async () => {
  const app = await launchPackagedApp();

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Timestamped so this doesn't collide with notes left behind by a previous e2e run - the
    // packaged app persists its SQLite file in the OS userData dir across runs, unlike the
    // in-memory DataSources the unit tests use.
    const title = `E2E note ${Date.now()}`;
    await window.getByPlaceholder('Title').fill(title);
    await window.getByPlaceholder('Content').fill('Created by Playwright');
    await window.getByRole('button', { name: 'Add note' }).click();

    const note = window.locator('.note', { hasText: title });
    await expect(note).toBeVisible();

    // The bundled Material Icons font, verified where it can actually fail. styles.css imports
    // it for <mat-icon>, and the renderer loads it from file:// under the packaged CSP - so a
    // dropped @font-face, a font file missing from the asar, or a CSP that refused it all land
    // here. None of them throw: the ligature simply doesn't form and the button renders the
    // literal word "delete" instead of a glyph.
    const icon = await measureIcon(note.locator('mat-icon'));

    // Two independent signals, because the obvious checks are both false comfort. The host
    // element is a fixed 24x24 box with overflow:hidden, so its bounding box reads 24 whether
    // or not the glyph rendered; and document.fonts.check() answers "can this be drawn at all",
    // so it returns true off the fallback font when no matching @font-face exists. Verified by
    // deleting the import and re-packaging: the box stayed 24 and check() stayed true, while
    // both assertions below flipped.
    //
    // The advance width of the text itself is the real evidence: one ligature glyph is a 24px
    // em square, against 57px for the six letters spelled out in the fallback face.
    expect(icon.faceLoaded).toBe(true);
    expect(icon.textAdvance).toBeLessThan(32);

    await note.getByRole('button', { name: 'Delete' }).click();
    await expect(note).toHaveCount(0);
  } finally {
    await app.close();
  }
});

// Measures a <mat-icon> once webfonts have settled: whether the Material Icons face actually
// downloaded, and how wide its text really lays out. The width comes from a Range over the text
// node rather than from the element, since the element's own box is fixed by Material's styles
// and clips the overflow.
async function measureIcon(icon: Locator): Promise<{ faceLoaded: boolean; textAdvance: number }> {
  return icon.evaluate(async (element) => {
    await document.fonts.ready;
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      faceLoaded: [...document.fonts].some(
        (face) => face.family.replace(/["']/g, '') === 'Material Icons' && face.status === 'loaded'
      ),
      textAdvance: range.getBoundingClientRect().width,
    };
  });
}

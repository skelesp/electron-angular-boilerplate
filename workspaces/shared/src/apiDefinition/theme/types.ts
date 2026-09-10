import { z } from 'zod';
import { apiResponseSchema } from '../types.js';

/**
 * What the app is *asked* to do about appearance, mirroring Electron's
 * `nativeTheme.themeSource`: follow the operating system, or override it in one direction.
 * 'system' is the default, which is what makes the app follow the OS dark-mode switch.
 */
export const ThemeSourceSchema = z.enum(['system', 'light', 'dark']);
export type ThemeSource = z.infer<typeof ThemeSourceSchema>;

/**
 * What the app should actually *look* like right now. `source` and `shouldUseDarkColors`
 * are separate on purpose: with source 'system' the second one still flips when the user
 * changes their OS setting, and the renderer needs the resolved answer to paint with.
 */
export const ThemeStateSchema = z.strictObject({
  source: ThemeSourceSchema,
  shouldUseDarkColors: z.boolean(),
});
export type ThemeState = z.infer<typeof ThemeStateSchema>;

// No input: see ListNotesInputSchema for why this is z.undefined() and not z.object({}).
export const GetThemeInputSchema = z.undefined();
export type GetThemeInput = z.infer<typeof GetThemeInputSchema>;

export const GetThemeOutputSchema = apiResponseSchema(ThemeStateSchema);
export type GetThemeOutput = z.infer<typeof GetThemeOutputSchema>;

export const SetThemeSourceInputSchema = z.strictObject({
  source: ThemeSourceSchema,
});
export type SetThemeSourceInput = z.infer<typeof SetThemeSourceInputSchema>;

export const SetThemeSourceOutputSchema = apiResponseSchema(ThemeStateSchema);
export type SetThemeSourceOutput = z.infer<typeof SetThemeSourceOutputSchema>;

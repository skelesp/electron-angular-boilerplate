import { InferEndpoints } from '../types';
import {
  GetThemeInputSchema,
  GetThemeOutputSchema,
  SetThemeSourceInputSchema,
  SetThemeSourceOutputSchema,
} from './types';

export const themeApiName = 'theme';

export const themeEndpoints = {
  get: {
    channel: `${themeApiName}.get` as const,
    inputSchema: GetThemeInputSchema,
    outputSchema: GetThemeOutputSchema,
  },
  setSource: {
    channel: `${themeApiName}.setSource` as const,
    inputSchema: SetThemeSourceInputSchema,
    outputSchema: SetThemeSourceOutputSchema,
  },
} as const;

export type ThemeApiEndpoints = InferEndpoints<typeof themeEndpoints>;

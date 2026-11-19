import { hexToLinear } from './util';

// The project palette: every project sets its own colours here (the key names stay: glsl/common.ts bakes them into
// GLSL constants C_INK, C_BONE, C_SIGNAL …). The defaults are neutral placeholders (greys and one plain blue),
// not a look: choose the film's colours here first.
export const HEX = {
  // Senbonzakura: a moonlit night inside a thousand vermilion torii (docs/TREATMENT.md)
  ink: '#070912', // night
  ink2: '#111628', // night sky near the horizon
  graphite: '#3B4160', // dim lines
  ash: '#8E93AD', // secondary text
  bone: '#F3EEE4', // paper white: the lyrics, the moon
  signal: '#D9361A', // torii vermilion
  ember: '#F6A6BE', // sakura pink
  blood: '#6E1209', // deep lacquer red in shadow
  acid: '#FFB866', // lantern fire
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

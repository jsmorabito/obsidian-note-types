import { addIcon, removeIcon } from 'obsidian';

/** Icon id for note types: a page with frontmatter lines (frontmatter.svg). */
export const NOTE_TYPES_ICON = 'ffc-note-types';

/** The icon's paths, drawn on a 24 x 24 grid. */
const PATHS = [
  'M6 22C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V4C4 3.46957 4.21071 2.96086 4.58579 2.58579C4.96086 2.21071 5.46957 2 6 2H14C14.3166 1.99949 14.6301 2.0616 14.9225 2.18277C15.215 2.30393 15.4806 2.48176 15.704 2.706L19.292 6.294C19.5168 6.51751 19.6952 6.78334 19.8167 7.07616C19.9382 7.36898 20.0005 7.68297 20 8V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6Z',
  'M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20',
  'M9 13H8', 'M9 17H8', 'M12.5 13H11.5', 'M12.5 17H11.5', 'M16 13H15', 'M16 17H15',
];

/**
 * Obsidian draws custom icons on a 100 x 100 grid, so scale the 24 x 24 paths
 * up. The line weight comes from `--icon-stroke`, so it matches the built-in
 * icons at every size and in every theme. The fill is `--ffc-icon-fill`, hollow unless a
 * place sets it (the canvas card menu fills its icons with the page colour, as core does).
 */
const CONTENT = `<g transform="scale(${100 / 24})" stroke="currentColor" stroke-linecap="round" `
  + `stroke-linejoin="round" style="stroke-width: var(--icon-stroke, 2px); fill: var(--ffc-icon-fill, none)">`
  + PATHS.map((d) => `<path d="${d}"/>`).join('')
  + '</g>';

/** Register the icon; returns a function that removes it again (for plugin unload). */
export function registerIcons(): () => void {
  addIcon(NOTE_TYPES_ICON, CONTENT);
  return () => removeIcon(NOTE_TYPES_ICON);
}

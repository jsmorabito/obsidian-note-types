import { App, Setting } from 'obsidian';
import { NoteType } from '../types.ts';
import { FrontmatterValueSuggest } from '../ui/frontmatter-value-suggest.ts';

/**
 * Safely stringify a frontmatter value for display. Unlike a bare `String(v)`,
 * this avoids rendering non-primitive values (arrays/objects from malformed
 * YAML) as the useless "[object Object]".
 */
export function stringifyFrontmatterValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return ''; }
}

/**
 * True when `text` is a single bare http(s) URL with no surrounding whitespace.
 * Used to decide whether a highlighted selection should be routed into a note
 * type's designated URL field instead of its title.
 */
export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/**
 * Strip characters that are illegal in Obsidian note titles / file names,
 * collapse whitespace, and cap the length, so a fetched page title can be used
 * as a filename.
 */
export function sanitizeNoteTitle(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .trim();
}

/**
 * Convert a note type name to a stable command slug.
 * e.g. "My Task" → "my-task", "  Hello World! " → "hello-world"
 */
export function nameToCommandSlug(name: string): string {
  return (name || 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'note';
}

/**
 * Command slug for `name` that isn't already in `taken`, appending `-2`, `-3`, …
 * on collision. Pure — does not mutate `taken`.
 */
export function uniqueCommandSlug(name: string, taken: Set<string>): string {
  const base = nameToCommandSlug(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * Render the extra frontmatter fields defined on a note type into a container.
 * Attaches vault-wide autocomplete to every field input.
 */
export function renderFieldInputs(
  container: HTMLElement,
  app: App,
  noteType: NoteType | undefined,
  fieldValues: Record<string, string>,
  onEnter: () => void,
  insertBefore: HTMLElement | null = null,
): void {
  // Remove only previously-rendered dynamic field rows
  container.querySelectorAll('[data-ffc-field]').forEach(el => el.remove());

  const fields = noteType?.fields ?? [];
  for (const field of fields) {
    const s = new Setting(container)
      .setName(field.label || field.key)
      .setDesc(field.type === 'list' ? 'Separate multiple values with commas' : '')
      .addText((text) => {
        text
          .setPlaceholder(field.type === 'list' ? 'e.g. tag1, tag2' : '')
          .setValue(fieldValues[field.key] ?? '')
          .onChange((v) => { fieldValues[field.key] = v; });

        if (field.key?.trim()) {
          new FrontmatterValueSuggest(app, text.inputEl, field.key, field.type);
        }

        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') onEnter();
        });
      });

    (s.settingEl as HTMLElement & { dataset: DOMStringMap }).dataset['ffcField'] = 'true';

    if (insertBefore) container.insertBefore(s.settingEl, insertBefore);
  }
}

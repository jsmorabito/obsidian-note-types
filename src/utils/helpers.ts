import { App, Setting } from 'obsidian';
import { ObjectType } from '../types.ts';
import { FrontmatterValueSuggest } from '../ui/frontmatter-value-suggest.ts';

/**
 * Convert an object type name to a stable command slug.
 * e.g. "My Task" → "my-task", "  Hello World! " → "hello-world"
 */
export function nameToCommandSlug(name: string): string {
  return (name || 'object')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'object';
}

/**
 * Collect every distinct frontmatter value used for `key` across the vault,
 * sorted case-insensitively. For tag/tags keys the tag cache is also consulted.
 */
export function getVaultValuesForKey(app: App, key: string): string[] {
  const values = new Set<string>();
  if (key === 'tags' || key === 'tag') {
    const tags = (app.metadataCache as any).getTags() ?? {};
    for (const tag of Object.keys(tags)) {
      values.add(tag.startsWith('#') ? tag.slice(1) : tag);
    }
  }
  for (const file of app.vault.getMarkdownFiles()) {
    const raw = app.metadataCache.getFileCache(file)?.frontmatter?.[key];
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      (raw as unknown[]).forEach((v) => { if (v != null) values.add(String(v).trim()); });
    } else {
      const s = String(raw).trim();
      if (s) values.add(s);
    }
  }
  return [...values].filter(Boolean)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Render the extra frontmatter fields defined on an object type into a container.
 * Attaches vault-wide autocomplete to every field input.
 */
export function renderFieldInputs(
  container: HTMLElement,
  app: App,
  objType: ObjectType | undefined,
  fieldValues: Record<string, string>,
  onEnter: () => void,
  insertBefore: HTMLElement | null = null,
): void {
  // Remove only previously-rendered dynamic field rows
  container.querySelectorAll('[data-ffc-field]').forEach(el => el.remove());

  const fields = objType?.fields ?? [];
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

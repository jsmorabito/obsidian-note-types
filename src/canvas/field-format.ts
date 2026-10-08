/** One frontmatter value as card text: wikilinks show their alias or note name, links are not left as `[[…]]`. */
function single(value: unknown): string {
  const text = typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  const trimmed = text.trim();
  const link = /^!?\[\[([^\]]*)\]\]$/.exec(trimmed);
  if (!link) return trimmed;
  const [target, alias] = link[1].split('|');
  return (alias ?? target.split('#')[0].split('/').pop() ?? '').trim();
}

/** A property's value for a card row: lists are joined with commas, empty parts dropped. Empty string means nothing to show. */
export function displayValue(raw: unknown): string {
  return (Array.isArray(raw) ? raw : [raw]).map(single).filter(Boolean).join(', ');
}

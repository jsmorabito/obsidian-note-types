import { App, CachedMetadata, TFile, getAllTags, setIcon } from 'obsidian';
import {
  FfwFilter, FfwTagFilter, FfwFrontmatterFilter, FfwPathFilter,
  FfwNameFilter, FfwSection, FfwSort, FfwFilterType,
} from '../types.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

export const FFW_VIEW_TYPE = 'filtered-files-widget-view';

export const FFW_FILTER_TYPE_LABELS: Record<FfwFilterType, string> = {
  tag:         'Tag',
  frontmatter: 'Frontmatter',
  path:        'Path / folder',
  name:        'File name',
};

export const FFW_SORT_OPTIONS = [
  { value: 'modified-desc',    label: 'Modified (newest)' },
  { value: 'modified-asc',     label: 'Modified (oldest)' },
  { value: 'created-desc',     label: 'Created (newest)'  },
  { value: 'created-asc',      label: 'Created (oldest)'  },
  { value: 'name-asc',         label: 'Name (A→Z)'        },
  { value: 'name-desc',        label: 'Name (Z→A)'        },
  { value: 'frontmatter-asc',  label: 'Frontmatter field (asc)'  },
  { value: 'frontmatter-desc', label: 'Frontmatter field (desc)' },
];

// ─── ID generation ────────────────────────────────────────────────────────────

export function ffwNewSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Default constructors ─────────────────────────────────────────────────────

export function ffwDefaultFilter(type: FfwFilterType): FfwFilter {
  switch (type) {
    case 'tag':         return { type: 'tag',         tag: '',      include: true };
    case 'frontmatter': return { type: 'frontmatter', key: '',      value: '', comparison: 'equals' };
    case 'path':        return { type: 'path',        pattern: '',  matchMode: 'starts-with', negate: false };
    case 'name':        return { type: 'name',        pattern: '',  matchMode: 'contains', caseSensitive: false, negate: false };
  }
}

export function ffwDefaultSort(): FfwSort {
  return { field: 'modified-desc' };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function ffwSortLabel(sort: FfwSort): string {
  switch (sort.field) {
    case 'created-desc':     return 'Created (newest)';
    case 'created-asc':      return 'Created (oldest)';
    case 'modified-desc':    return 'Modified (newest)';
    case 'modified-asc':     return 'Modified (oldest)';
    case 'name-asc':         return 'Name (A-Z)';
    case 'name-desc':        return 'Name (Z-A)';
    case 'frontmatter-asc':  return `Frontmatter "${sort.frontmatterKey ?? ''}" (asc)`;
    case 'frontmatter-desc': return `Frontmatter "${sort.frontmatterKey ?? ''}" (desc)`;
    default:                 return sort.field;
  }
}

/** Fuzzy match: every character in `query` must appear in `str` in order. */
export function ffwFuzzyMatch(query: string, str: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const s = str.toLowerCase();
  let n = 0;
  for (let i = 0; i < s.length && n < q.length; i++) {
    if (s[i] === q[n]) n++;
  }
  return n === q.length;
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return --
   Reflects into the third-party "Iconic" community plugin's internals, which publishes no types
   and whose shape can change without notice; every access below is already defensively guarded. */
/** Read a file's icon/color from the Iconic plugin if installed. */
export function ffwGetIconicIcon(app: App, file: TFile): { icon: string; color?: string | null } | null {
  try {
    const plugins = (app as any).plugins?.plugins;
    if (!plugins) return null;
    const iconic = plugins.iconic;
    if (!iconic) return null;
    if (typeof iconic.getFileItem === 'function') {
      const item = iconic.getFileItem(file.path);
      if (item?.icon) return item;
    }
    const lm = iconic.ruleManager;
    if (lm?.fileRulings instanceof Map) {
      const c = lm.fileRulings.get(file.path);
      if (c) {
        const icon = c.icon ?? c.iconDefault ?? null;
        if (icon) return { icon, color: c.color ?? null };
      }
    }
    for (const src of [iconic.settings, iconic.data]) {
      if (!src) continue;
      for (const key of ['fileIcons', 'file', 'files']) {
        const store = src[key];
        if (!store) continue;
        const entry = store[file.path];
        if (entry?.icon) return entry;
      }
    }
  } catch { /* ignore */ }
  return null;
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return --
   End of the Iconic-plugin reflection block. */

/** Render an icon string (Lucide id or emoji) into an element, with optional color. */
export function ffwSetIconEl(el: HTMLElement, icon: string, color: string | null | undefined): void {
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon)) {
    setIcon(el, icon);
  } else {
    el.setText(icon);
    el.addClass('ffw-file-icon--emoji');
  }
  if (color) el.style.color = color;
}

/** Coerce a raw frontmatter value to a string for comparisons / display. */
export function ffwFormatValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return ''; }
}

/** Normalise a tag string: trim, strip leading #, lower-case. */
export function ffwNormalizeTag(tag: string): string {
  return (tag || '').trim().replace(/^#/, '').toLowerCase();
}

// ─── Per-filter evaluators ────────────────────────────────────────────────────

export function ffwEvalTagFilter(cache: CachedMetadata | null, filter: FfwTagFilter): boolean {
  const tag = ffwNormalizeTag(filter.tag);
  if (!tag) return true;
  const allTags = cache ? (getAllTags(cache) ?? []).map(ffwNormalizeTag) : [];
  const has = allTags.includes(tag);
  return filter.include ? has : !has;
}

export function ffwEvalFrontmatterFilter(cache: CachedMetadata | null, filter: FfwFrontmatterFilter): boolean {
  if (!filter.key) return true;
  const fm = cache?.frontmatter;
  if (!fm) return filter.comparison === 'not-equals';
  const raw: unknown = fm[filter.key];
  if (filter.comparison === 'exists') return raw != null && raw !== '';
  if (raw == null) return filter.comparison === 'not-equals';
  const needle = filter.value.trim().toLowerCase();
  const values: string[] = Array.isArray(raw) ? (raw as unknown[]).map(ffwFormatValue) : [ffwFormatValue(raw)];
  switch (filter.comparison) {
    case 'equals':     return values.some((v) => v.toLowerCase() === needle);
    case 'not-equals': return !values.some((v) => v.toLowerCase() === needle);
    case 'contains':   return values.some((v) => v.toLowerCase().includes(needle));
    default:           return true;
  }
}

export function ffwEvalPathFilter(file: TFile, filter: FfwPathFilter): boolean {
  if (!filter.pattern) return true;
  const path    = file.path;
  const pattern = filter.pattern;
  let matches: boolean;
  switch (filter.matchMode) {
    case 'starts-with': matches = path.startsWith(pattern); break;
    case 'ends-with':   matches = path.endsWith(pattern);   break;
    case 'equals':      matches = path === pattern;         break;
    case 'contains':    matches = path.includes(pattern);   break;
    default:            matches = false;
  }
  return filter.negate ? !matches : matches;
}

export function ffwEvalNameFilter(file: TFile, filter: FfwNameFilter): boolean {
  if (!filter.pattern) return true;
  const name    = filter.caseSensitive ? file.basename : file.basename.toLowerCase();
  const pattern = filter.caseSensitive ? filter.pattern : filter.pattern.toLowerCase();
  let matches: boolean;
  switch (filter.matchMode) {
    case 'contains':    matches = name.includes(pattern);    break;
    case 'starts-with': matches = name.startsWith(pattern);  break;
    case 'ends-with':   matches = name.endsWith(pattern);    break;
    case 'regex':
      try { matches = new RegExp(filter.pattern, filter.caseSensitive ? '' : 'i').test(file.basename); }
      catch { matches = false; }
      break;
    default: matches = false;
  }
  return filter.negate ? !matches : matches;
}

export function ffwApplyFilter(file: TFile, cache: CachedMetadata | null, filter: FfwFilter): boolean {
  switch (filter.type) {
    case 'tag':         return ffwEvalTagFilter(cache, filter);
    case 'frontmatter': return ffwEvalFrontmatterFilter(cache, filter);
    case 'path':        return ffwEvalPathFilter(file, filter);
    case 'name':        return ffwEvalNameFilter(file, filter);
    default:            return true;
  }
}

// ─── File retrieval & sorting ─────────────────────────────────────────────────

export function ffwGetFrontmatterSortValue(
  app: App,
  file: TFile,
  key: string,
): string | number | undefined {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!fm) return undefined;
  const val: unknown = fm[key];
  if (val == null || val === '') return undefined;
  return typeof val === 'number' || typeof val === 'string'
    ? val
    : Array.isArray(val) ? (val as unknown[]).map(ffwFormatValue).join(', ')
    : ffwFormatValue(val);
}

export function ffwSortFiles(files: TFile[], app: App, sort: FfwSort): TFile[] {
  const arr = files.slice();
  switch (sort.field) {
    case 'created-desc':  return arr.sort((a, b) => b.stat.ctime - a.stat.ctime);
    case 'created-asc':   return arr.sort((a, b) => a.stat.ctime - b.stat.ctime);
    case 'modified-desc': return arr.sort((a, b) => b.stat.mtime - a.stat.mtime);
    case 'modified-asc':  return arr.sort((a, b) => a.stat.mtime - b.stat.mtime);
    case 'name-asc':      return arr.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { sensitivity: 'base' }));
    case 'name-desc':     return arr.sort((a, b) => b.basename.localeCompare(a.basename, undefined, { sensitivity: 'base' }));
    case 'frontmatter-asc':
    case 'frontmatter-desc': {
      const key = sort.frontmatterKey;
      if (!key) return arr;
      const dir = sort.field === 'frontmatter-asc' ? 1 : -1;
      return arr.sort((a, b) => {
        const va = ffwGetFrontmatterSortValue(app, a, key);
        const vb = ffwGetFrontmatterSortValue(app, b, key);
        if (va === undefined && vb === undefined) return 0;
        if (va === undefined) return 1;
        if (vb === undefined) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * dir;
      });
    }
    default: return arr;
  }
}

export function ffwGetSectionFiles(app: App, section: FfwSection): TFile[] {
  const files = app.vault.getMarkdownFiles().filter((file) => {
    const cache = app.metadataCache.getFileCache(file);
    return section.filters.every((filter) => ffwApplyFilter(file, cache, filter));
  });
  const sorted = ffwSortFiles(files, app, section.sort);
  return section.maxResults && section.maxResults > 0 ? sorted.slice(0, section.maxResults) : sorted;
}

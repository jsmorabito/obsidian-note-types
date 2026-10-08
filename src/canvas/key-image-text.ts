/**
 * Text edits for a note's key image: the first image in its first paragraph
 * after the frontmatter. Pure string functions, so they are easy to check.
 */

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** A fresh regex each time: a shared global one carries `lastIndex` between uses. */
const imageRe = (): RegExp => /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

function split(text: string): { head: string; body: string } {
  const head = FRONTMATTER_RE.exec(text)?.[0] ?? '';
  return { head, body: text.slice(head.length) };
}

/** The first paragraph of `body` (up to the first blank line) and the rest, starting at that blank line. */
function firstBlock(body: string): { block: string; rest: string; lead: string } {
  const lead = /^\s*/.exec(body)?.[0] ?? '';
  const trimmed = body.slice(lead.length);
  const end = trimmed.search(/\r?\n[ \t]*\r?\n/);
  return end === -1
    ? { lead, block: trimmed, rest: '' }
    : { lead, block: trimmed.slice(0, end), rest: trimmed.slice(end) };
}

/** Put `markup` on its own line at the top of the body, so it becomes the first image. */
export function addKeyImage(text: string, markup: string): string {
  const { head, body } = split(text);
  const rest = body.replace(/^(?:[ \t]*\r?\n)+/, '');
  return `${head}${markup}\n${rest ? '\n' : ''}${rest}`;
}

/** Overwrite the first image's markup in place. A literal replacer, so `$` in paths isn't a pattern. */
export function replaceKeyImage(text: string, markup: string): string {
  const { head, body } = split(text);
  const { lead, block, rest } = firstBlock(body);
  const next = block.replace(imageRe(), () => markup);
  return head + lead + next + rest;
}

/** Delete the first image's line when it holds only that image; otherwise strip just the markup. */
export function removeKeyImage(text: string): string {
  const { head, body } = split(text);
  const { lead, block, rest } = firstBlock(body);
  const m = imageRe().exec(block);
  if (!m) return text;
  const lines = block.split(/\r?\n/);
  const at = lines.findIndex((l) => imageRe().test(l));
  const stripped = lines[at].replace(imageRe(), '').trim();
  if (stripped) lines[at] = lines[at].replace(m[0], '').replace(/[ \t]{2,}/g, ' ').trim();
  else lines.splice(at, 1);
  const next = lines.join('\n');
  // An emptied first paragraph also loses the blank line that separated it.
  return next ? head + lead + next + rest : head + rest.replace(/^(?:\r?\n[ \t]*)+/, '');
}

import { Modal } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { RelationType } from '../types.ts';
import { resolvedRelation } from '../relations.ts';
import { NoteRef, usageBetween } from './relation-logic.ts';

export type MenuChoice =
  | { kind: 'relation'; rt: RelationType; reversed: boolean }
  | { kind: 'create'; name: string; complement: string }
  | { kind: 'arrow' };

interface Row {
  choice: MenuChoice;
  label: string;
  hint?: string;
  section: 'forward' | 'reverse' | 'other';
}

/**
 * Picks the relation for a connection between two note cards. Every relation type is offered in both
 * directions; the pair's note types only change the order (types already used between them come
 * first). Resolves with the choice, or null when dismissed, which cancels the connection.
 */
export class RelationMenu extends Modal {
  private resolve!: (choice: MenuChoice | null) => void;
  private settled = false;
  private rows: Row[] = [];
  private selected = 0;
  private query = '';
  private listEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  /** Filled in just after the menu opens, so counting never delays it. */
  private usedForward = new Map<string, number>();
  private usedReverse = new Map<string, number>();
  private moved = false;

  constructor(private plugin: FilteredFileCommandsPlugin, private from: NoteRef, private to: NoteRef) {
    super(plugin.app);
  }

  choose(): Promise<MenuChoice | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    this.modalEl.addClass('ffc-relation-menu');
    this.contentEl.empty();
    this.showList();
    // Count after the empty menu has painted: a timeout alone can run before the first frame.
    window.requestAnimationFrame(() => window.setTimeout(() => {
      if (this.settled) return;
      const usage = usageBetween(this.plugin, this.from.type, this.to.type);
      this.usedForward = usage.forward;
      this.usedReverse = usage.reverse;
      // Keep the user's place if they've already moved the selection.
      if (this.contentEl.querySelector('.ffc-relation-list')) this.rebuild(!this.moved);
    }, 0));
  }

  onClose(): void {
    this.contentEl.empty();
    this.finish(null);
  }

  private finish(choice: MenuChoice | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(choice);
  }

  private pick(choice: MenuChoice): void {
    this.finish(choice);
    this.close();
  }

  private showList(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.inputEl = contentEl.createEl('input', {
      type: 'text',
      cls: 'ffc-relation-input',
      attr: { placeholder: `Relation for ${this.from.type.name} → ${this.to.type.name}` },
    });
    this.listEl = contentEl.createDiv({ cls: 'ffc-relation-list' });
    this.inputEl.addEventListener('input', () => {
      this.query = this.inputEl.value;
      this.rebuild(true);
    });
    this.inputEl.addEventListener('keydown', (e) => this.onKey(e));
    this.rebuild(true);
    this.inputEl.focus();
  }

  private buildRows(): Row[] {
    const q = this.query.trim().toLowerCase();
    const types = this.plugin.settings.relationTypes;
    const byFit = (a: Row, b: Row): number => {
      const ah = a.hint ? 0 : 1;
      const bh = b.hint ? 0 : 1;
      return ah - bh || a.label.localeCompare(b.label);
    };
    const hint = (n: number | undefined, a: string, b: string): string | undefined =>
      n ? `Used ${n} ${n === 1 ? 'time' : 'times'} between ${a} and ${b}` : undefined;

    const forward: Row[] = [];
    const reverse: Row[] = [];
    for (const rt of types) {
      const r = resolvedRelation(rt);
      if (!q || r.forwardName.toLowerCase().includes(q)) {
        forward.push({
          choice: { kind: 'relation', rt, reversed: false }, label: r.forwardName, section: 'forward',
          hint: hint(this.usedForward.get(rt.id), this.from.type.name, this.to.type.name),
        });
      }
      // A relation that reads the same both ways has no separate "other direction".
      if (!r.symmetric && (!q || r.reverseName.toLowerCase().includes(q))) {
        reverse.push({
          choice: { kind: 'relation', rt, reversed: true }, label: r.reverseName, section: 'reverse',
          hint: hint(this.usedReverse.get(rt.id), this.to.type.name, this.from.type.name),
        });
      }
    }
    forward.sort(byFit);
    reverse.sort(byFit);

    const rows = [...forward, ...reverse];
    const exact = types.some((rt) => {
      const r = resolvedRelation(rt);
      return [r.forwardName, r.reverseName].some((n) => n.toLowerCase() === q);
    });
    if (q && !exact) {
      const name = this.query.trim();
      rows.push({ choice: { kind: 'create', name, complement: '' }, label: `Create “${name}”`, section: 'other' });
    }
    rows.push({ choice: { kind: 'arrow' }, label: 'Just an arrow', section: 'other' });
    return rows;
  }

  private rebuild(preselect: boolean): void {
    this.rows = this.buildRows();
    if (preselect) {
      // Best fit: the first row with a usage hint, which may be in the other direction.
      const best = this.rows.findIndex((r) => r.hint);
      this.selected = best === -1 ? 0 : best;
    }
    this.selected = Math.min(this.selected, this.rows.length - 1);
    this.render();
  }

  private render(): void {
    this.listEl.empty();
    let section: Row['section'] | null = null;
    this.rows.forEach((row, i) => {
      if (row.section !== section) {
        section = row.section;
        const title = row.section === 'forward'
          ? `${this.from.type.name} → ${this.to.type.name}`
          : row.section === 'reverse' ? 'Other direction' : '';
        if (title) this.listEl.createDiv({ cls: 'ffc-relation-section', text: title });
      }
      const el = this.listEl.createDiv({ cls: 'ffc-relation-row' });
      el.toggleClass('is-selected', i === this.selected);
      el.createSpan({ cls: 'ffc-relation-label', text: row.label });
      if (row.hint) el.createSpan({ cls: 'ffc-relation-hint', text: row.hint });
      el.addEventListener('click', () => this.activate(row));
      el.addEventListener('mousemove', () => {
        if (this.selected === i) return;
        this.moved = true;
        this.selected = i;
        this.listEl.querySelector('.is-selected')?.removeClass('is-selected');
        el.addClass('is-selected');
      });
    });
    this.listEl.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.moved = true;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.selected = (this.selected + step + this.rows.length) % this.rows.length;
      this.render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = this.rows[this.selected];
      if (row) this.activate(row);
    }
  }

  private activate(row: Row): void {
    if (row.choice.kind === 'create') this.showCreateForm(row.choice.name);
    else this.pick(row.choice);
  }

  /** A small form for a new relation type: the name is fixed, the complement is optional. */
  private showCreateForm(name: string): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv({ cls: 'ffc-relation-section', text: `New relation “${name}”` });
    const input = contentEl.createEl('input', {
      type: 'text',
      cls: 'ffc-relation-input',
      attr: { placeholder: 'Complement (optional)' },
    });
    const buttons = contentEl.createDiv({ cls: 'ffc-relation-buttons' });
    const create = buttons.createEl('button', { text: 'Create', cls: 'mod-cta' });
    const back = buttons.createEl('button', { text: 'Back' });
    const submit = (): void => this.pick({ kind: 'create', name, complement: input.value });
    create.addEventListener('click', submit);
    back.addEventListener('click', () => this.showList());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    input.focus();
  }
}

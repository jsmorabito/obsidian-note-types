import { AbstractInputSuggest, App, TFolder } from 'obsidian';

/** Autocompletes vault folder paths in a text input. */
export class FolderInputSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFolder[] {
    const q = query.toLowerCase();
    return this.app.vault.getAllFolders(false).filter((f) => f.path.toLowerCase().includes(q));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}

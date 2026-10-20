import { App, Setting } from 'obsidian';
import type { NoteType } from '../types.ts';
import { effectiveSaveLocation, type SaveLocation } from '../utils/note-type-factory.ts';
import { FolderInputSuggest } from './folder-suggest.ts';

/**
 * Obsidian-core style "Default location for new notes" dropdown with a
 * conditional folder field. Mutates `target`; `onChange` runs after each edit.
 */
export function addSaveLocationSettings(
  app: App,
  container: HTMLElement,
  target: Pick<NoteType, 'saveLocation' | 'saveFolder'>,
  onChange: () => void | Promise<void> = () => {},
): void {
  const folderEl = container.createDiv();
  const renderFolder = () => {
    folderEl.empty();
    if (effectiveSaveLocation(target) !== 'folder') return;
    new Setting(folderEl)
      .setName('Folder to create new notes in')
      .setDesc('Newly created notes will appear in this folder.')
      .addText((text) => {
        text.setPlaceholder('Example: folder 1/folder').setValue(target.saveFolder || '')
          .onChange(async (v) => { target.saveFolder = v.trim(); await onChange(); });
        new FolderInputSuggest(app, text.inputEl);
      });
  };

  const dropdownSetting = new Setting(container)
    .setName('Default location for new notes')
    .setDesc('Where notes of this type are placed.')
    .addDropdown((dd) => dd
      .addOption('vault', 'Vault folder')
      .addOption('current', 'Same folder as current file')
      .addOption('folder', 'In the folder specified below')
      .setValue(effectiveSaveLocation(target))
      .onChange(async (v) => {
        target.saveLocation = v as SaveLocation;
        await onChange();
        renderFolder();
      }));
  // Keep the folder row directly under the dropdown.
  container.insertBefore(folderEl, dropdownSetting.settingEl.nextSibling);
  renderFolder();
}

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { EditorState } from '@codemirror/state';

let iconAvailable = false;
const icon = { name: 'type-icon' };
function span({ cls }) {
  return {
    cls, style: {}, children: [], attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); },
    prepend(child) { this.children.unshift(child); },
  };
}
const result = await build({
  entryPoints: ['src/views/note-link-view-plugin.ts'],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['@codemirror/state', '@codemirror/view'],
  plugins: [{
    name: 'obsidian-test-stub',
    setup(build) {
      build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
        export const editorInfoField = 'info';
        export const editorLivePreviewField = 'live';
        export const getIcon = () => resolveIcon();
      ` }));
    },
  }],
});
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, {
  module, exports: module.exports, require: createRequire(import.meta.url),
  DOMParser: class {},
  resolveIcon: () => iconAvailable ? icon : null,
  createSpan: span,
});
const { buildNoteLinkViewPlugin } = module.exports;

function createInstance(live, cursor = 0, color = '#123456') {
  const state = EditorState.create({ doc: 'Text [[Example]] and [[Example|Alias]].', selection: { anchor: cursor } });
  const plugin = buildNoteLinkViewPlugin({
    styledNoteBasenames: new Set(['Example']),
    previewNoteBasenames: new Set(), statusNoteMap: new Map(),
    noteLinkStyle: () => ({ color, icon: 'book-open' }),
  });
  const view = {
    state: {
      doc: state.doc, selection: state.selection,
      field: (field) => field === 'live' ? live : undefined,
    },
    dom: { querySelectorAll: () => [] },
  };
  return { instance: plugin.create(view), view };
}

function rangesOf(instance) {
  const ranges = [];
  for (let iter = instance.decorations.iter(); iter.value; iter.next()) {
    ranges.push({ from: iter.from, to: iter.to, spec: iter.value.spec });
  }
  return ranges;
}

function decorations(live, cursor = 0) {
  return rangesOf(createInstance(live, cursor).instance);
}

test('source mode renders one icon widget per link, not per syntax fragment', () => {
  const ranges = decorations(false);
  const widgets = ranges.filter((range) => range.spec.widget);
  assert.deepEqual(widgets.map(({ from, to }) => [from, to]), [[5, 5], [21, 21]]);
  for (const range of ranges.filter((range) => !range.spec.widget)) {
    assert.ok(!range.spec.attributes.style.includes('--ffc-note-link-icon'));
    assert.ok(range.spec.class.includes('ffc-note-link-editing'));
  }
});

test('live preview does not add source-mode widgets', () => {
  assert.ok(decorations(true).every((range) => !range.spec.widget));
});

test('editing a source link hides its icon without affecting other links', () => {
  const widgets = decorations(false, 8).filter((range) => range.spec.widget);
  assert.deepEqual(widgets.map((range) => range.from), [21]);
});

test('source widgets detect late icon resolution and render with the link color', (t) => {
  iconAvailable = false;
  t.after(() => { iconAvailable = false; });
  const { instance } = createInstance(false);
  const missing = rangesOf(instance)[0].spec.widget;
  const missingAgain = rangesOf(createInstance(false).instance)[0].spec.widget;
  // Compare widgets with identical properties, apart from resolution state.
  const missingDefault = rangesOf(createInstance(false, 0, null).instance)[0].spec.widget;
  iconAvailable = true;
  const resolved = rangesOf(createInstance(false).instance)[0].spec.widget;
  const defaultColor = rangesOf(createInstance(false, 0, null).instance)[0].spec.widget;
  assert.equal(missing.eq(missingAgain), true);
  assert.equal(missing.eq(resolved), false);
  assert.equal(missingDefault.eq(defaultColor), false);
  assert.equal(resolved.eq(rangesOf(createInstance(false).instance)[0].spec.widget), true);

  const domView = { dom: { ownerDocument: { adoptNode: (node) => node } } };
  assert.equal(defaultColor.toDOM(domView).style.color, 'var(--tag-color)');
  const customDom = resolved.toDOM(domView);
  assert.equal(customDom.style.color, '#123456');
  assert.equal(customDom.children[0].children[0], icon);
});

test('mode changes rebuild decorations in both directions', () => {
  const { instance, view } = createInstance(false);
  const sourceState = view.state;
  const liveState = { ...sourceState, field: (field) => field === 'live' ? true : undefined };
  function switchMode(startState, state) {
    view.state = state;
    instance.update({ startState, state, view, transactions: [], docChanged: false, viewportChanged: false, selectionSet: false });
  }
  switchMode(sourceState, liveState);
  assert.ok(rangesOf(instance).every((range) => !range.spec.widget));
  switchMode(liveState, sourceState);
  assert.equal(rangesOf(instance).filter((range) => range.spec.widget).length, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('src/theme.js', 'utf8');
function start(saved, blocked = false) {
  const events = {}, controlEvents = {}, systemEvents = {};
  const root = { dataset: {}, style: {} };
  const control = { value: '', addEventListener: (k, f) => controlEvents[k] = f };
  const media = { matches: true, addEventListener: (k, f) => systemEvents[k] = f };
  let stored = saved;
  vm.runInNewContext(source, {
    window: { matchMedia: () => media, addEventListener: (k, f) => events[k] = f },
    document: { documentElement: root, getElementById: () => control, addEventListener: (k, f) => events[k] = f },
    localStorage: { getItem() { if (blocked) throw Error(); return stored; }, setItem(k, v) { if (blocked) throw Error(); stored = v; } }
  });
  return { root, events, control, controlEvents, media, systemEvents, stored: () => stored };
}
test('theme follows system until explicitly selected, persists and synchronizes across tabs', () => {
  const a = start(null);
  assert.equal(a.root.dataset.theme, 'dark'); // applied before DOM ready
  a.events.DOMContentLoaded();
  assert.equal(a.control.value, 'system');
  a.media.matches = false; a.systemEvents.change();
  assert.equal(a.root.dataset.theme, 'light');
  a.controlEvents.change({ target: { value: 'dark' } });
  assert.equal(a.stored(), 'dark');
  a.systemEvents.change(); assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(start(a.stored()).root.dataset.theme, 'dark');
  a.events.storage({ key: 'emperors.theme', newValue: 'light' });
  assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.control.value, 'light');
});
test('theme tolerates blocked storage and invalid preferences', () => {
  const a = start('invalid', true); a.events.DOMContentLoaded();
  a.controlEvents.change({ target: { value: 'light' } });
  assert.equal(a.root.dataset.theme, 'light');
  a.events.storage({ key: 'emperors.theme', newValue: 'invalid' });
  assert.equal(a.root.dataset.theme, 'dark');
});

'use strict';
/* The Look up and Add translation panel, its letter keys, and the buttons beside the tape. */

/* ---------- in the app: Look up and Add translation, written with the sticks ----------
   Plover's own two windows, as a panel over the tape. While it is open, strokes go into its fields, and each field has
   its own translator state exactly as in Plover. The strokes you already have for Tab, Return and Escape change field,
   save and close. */
function doAct(what) {
  if (what === 'lookup' || what === 'add') {
    if (panel && panel.kind === what) closePrompt();
    else openPrompt(what);
  } else if (what === 'app')
    NATIVE.openApp('settings'); // the gear on the keyboard: straight to Settings on the app screen
  else if (what === 'keys') NATIVE.pickKeyboard();
  else if (what === 'setup') {
    if ($('setup').dataset.s === 'off') NATIVE.keyboardSettings();
    else NATIVE.pickKeyboard();
  } else if (what === 'setupx') {
    opt.setupSeen = $('setup').dataset.s;
    saveMeta();
    setupState();
  } else if (what === 'pclose') closePrompt();
  else if (what === 'pkb' && panel) {
    panel.kb = !panel.kb;
    if (panel.kb) promptField('text');
    drawPrompt();
  } else if (what === 'psave') promptSave();
  else if (what === 'ptab') promptField(panel && panel.field === 'strokes' ? 'text' : 'strokes');
  else if (what === 'pstrokes') promptField('strokes');
  else if (what === 'ptext') promptField('text');
}
function openPrompt(kind) {
  var st;
  try {
    st = ask('prompt_open', kind);
  } catch (e) {
    toast(e.message, true);
    return;
  }
  panel = {
    kind: kind,
    field: st.field,
    strokes: st.strokes,
    text: kind === 'add' ? st.translation : '',
    kb: kind === 'lookup',
    shift: false,
    sym: false,
  }; // kb: letter keys in place of the sticks. Looking a word up by fingerspelling it is no fun
  resetChord();
  $('prompt').hidden = false;
  drawPrompt();
  refresh();
}
function closePrompt() {
  if (!panel) return;
  try {
    ask('prompt_close');
  } catch (e) {}
  panel = null;
  $('prompt').hidden = true;
  deck.classList.remove('kb');
  refresh();
}
// the panel's own letter keys: plain typing into its text field, for words you have no strokes for yet
var LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
var SYMBOLS = [
  ['1234567890', '{}^&#*=\\/', '!?:;"()'],
  ['1234567890', '@$%+_|~<>', '[]`\u20AC\u00A3\u00B0\u2014'],
]; // the first page leads with what Plover entries are written in
function drawKeys() {
  var rows = panel.sym ? SYMBOLS[panel.shift ? 1 : 0] : LETTERS;
  function key(c) {
    return '<button data-q="' + esc(c) + '">' + esc(!panel.sym && panel.shift ? c.toUpperCase() : c) + '</button>';
  }
  $('qwerty').innerHTML =
    rows
      .map(function (row, r) {
        return (
          (r === 1
            ? '<i></i>'
            : r === 2
              ? '<button class="w3' +
                (panel.shift ? ' on' : '') +
                '" data-q="shift" aria-label="' +
                (panel.sym ? 'More symbols' : 'Capital') +
                '">' +
                (panel.sym ? (panel.shift ? '123' : '#+=') : '\u21E7') +
                '</button>'
              : '') +
          row.split('').map(key).join('') +
          (r === 1 ? '<i></i>' : r === 2 ? '<button class="w3" data-q="bs" aria-label="Delete">\u232B</button>' : '')
        );
      })
      .join('') +
    '<button class="w3" data-q="sticks">Sticks</button><button class="w3" data-q="sym">' +
    (panel.sym ? 'abc' : '123') +
    '</button><button data-q=",">,</button><button class="w6" data-q=" " aria-label="Space"></button><button data-q="-">-</button><button data-q="\'">\'</button><button data-q=".">.</button>';
}
function typeKey(k) {
  if (!panel) return;
  if (k === 'sticks') panel.kb = false;
  else if (k === 'sym') {
    panel.sym = !panel.sym;
    panel.shift = false;
  } else if (k === 'shift') panel.shift = !panel.shift;
  else {
    if (panel.field !== 'text') promptField('text');
    panel.text = k === 'bs' ? panel.text.slice(0, -1) : panel.text + (!panel.sym && panel.shift ? k.toUpperCase() : k);
    if (!panel.sym) panel.shift = false; // a capital is for one letter; the second symbol page stays until you leave it
    try {
      ask('prompt_typed');
    } catch (e) {}
  }
  drawPrompt();
}
function promptField(f) {
  if (!panel || panel.kind !== 'add' || panel.field === f) return;
  try {
    ask('prompt_focus', f);
  } catch (e) {
    toast(e.message, true);
    return;
  }
  panel.field = f;
  if (f === 'strokes') panel.kb = false;
  drawPrompt();
}
function promptSave() {
  if (!panel || panel.kind !== 'add') return;
  try {
    var a = ask('add_translation', panel.strokes, panel.text);
    closePrompt();
    toast('Saved ' + a.strokes + ' as "' + a.translation + '" in ' + a.dictionary);
    natRefresh();
  } catch (e) {
    toast(e.message, true);
  }
}
function promptOps(ops) {
  ops.forEach(function (op) {
    if (!panel) return;
    var k = panel.field === 'strokes' ? 'strokes' : 'text',
      c = String(op[1]).toLowerCase();
    if (op[0] === 'bs') panel[k] = panel[k].slice(0, Math.max(0, panel[k].length - op[1]));
    else if (op[0] === 'str') panel[k] += op[1];
    else if (op[0] !== 'combo') return;
    else if (/escape/.test(c)) closePrompt();
    else if (/return|kp_enter/.test(c)) {
      if (panel.kind === 'add') promptSave();
      else closePrompt();
    } else if (/tab/.test(c)) promptField(panel.field === 'strokes' ? 'text' : 'strokes');
    else if (/backspace/.test(c)) panel[k] = panel[k].slice(0, -1);
  });
  if (panel) drawPrompt();
}
function drawPrompt() {
  var add = panel.kind === 'add',
    C = '<span class="caret"></span>',
    info = '';
  function b(t) {
    return '<b>' + esc(t) + '</b>';
  }
  $('pTitle').textContent = add ? 'Add translation' : 'Look up';
  $('pStrokes').hidden = !add;
  $('pSave').hidden = !add;
  $('pTab').hidden = !add;
  $('pKb').textContent = panel.kb ? 'Sticks' : 'ABC';
  deck.classList.toggle('kb', panel.kb);
  if (panel.kb) drawKeys();
  $('pStrokes').className = 'pfield' + (panel.field === 'strokes' ? ' on' : '');
  $('pText').className = 'pfield' + (panel.field === 'text' ? ' on' : '');
  $('pStrokes').lastChild.innerHTML = esc(panel.strokes) + (panel.field === 'strokes' ? C : '');
  $('pText').firstChild.textContent = add ? 'translation' : 'word or phrase';
  $('pText').lastChild.innerHTML = esc(panel.text) + (panel.field === 'text' ? C : '');
  try {
    if (add) {
      var m = ask('mapping', panel.strokes, panel.text);
      info =
        (m.means != null
          ? b(m.strokes) + ' already means ' + b(m.means) + '. '
          : panel.strokes && !m.valid
            ? 'Those are not strokes this system can write. '
            : '') + (m.written.length ? 'Already written ' + m.written.map(b).join(', ') + '.' : '');
      if (!info)
        info =
          panel.strokes || panel.text
            ? ''
            : 'Write the strokes, then Tab, then what they should become. Return saves, Escape closes.';
    } else if (panel.text.trim()) {
      var found = ask('lookup', panel.text);
      info = found.length
        ? found
            .map(function (x) {
              return '<div>' + esc(x.text) + ': ' + x.outlines.slice(0, 8).map(b).join(', ') + '</div>';
            })
            .join('')
        : 'Nothing in your dictionaries writes that.';
    } else info = 'Type a word or phrase to see its strokes.';
  } catch (e) {
    info = esc(e.message);
  }
  $('pInfo').innerHTML = info;
}
// the app screen says so when the keyboard still has to be switched on or chosen in the phone's settings
function setupState() {
  if (IME) return;
  var st = NATIVE.keyboardState(),
    el = $('setup');
  el.dataset.s = st;
  el.hidden = st === 'current' || opt.setupSeen === st || opt.setupSeen === 'off'; // dismissed: "choose it" stays away for good; dismissing "switch it on" silences both
  $('setupMsg').textContent =
    st === 'off'
      ? 'To write in other apps, switch the Rings keyboard on in your phone\u2019s settings.'
      : 'Rings is switched on. Choose it as your keyboard to write in other apps.';
  $('setupBtn').textContent = st === 'off' ? 'Open settings' : 'Choose';
}
function hashPanel() {
  var h = location.hash.slice(1);
  if (!h || !ready) return;
  history.replaceState(null, '', location.pathname);
  if (h === 'settings') show('settings', true);
  else if (h === 'library') openLibrary();
}
window.addEventListener('focus', setupState);
window.addEventListener('hashchange', hashPanel);
if (IME) $('tools').hidden = false;
new ResizeObserver(function () {
  NATIVE.height(Math.ceil($('foot').getBoundingClientRect().height));
}).observe($('foot'));

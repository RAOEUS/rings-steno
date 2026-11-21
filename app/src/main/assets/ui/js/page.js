'use strict';
/* What has been written: the practice page on the app screen, the paper tape, and sending a finished stroke to Plover. */

/* ---------- the page being written: text, cursor, selection ---------- */
function sel() {
  return ed.anchor === null || ed.anchor === ed.cur ? null : [Math.min(ed.anchor, ed.cur), Math.max(ed.anchor, ed.cur)];
}
function replaceSel(s) {
  var r = sel();
  if (r) {
    ed.text = ed.text.slice(0, r[0]) + ed.text.slice(r[1]);
    ed.cur = r[0];
  }
  ed.anchor = null;
  ed.text = ed.text.slice(0, ed.cur) + s + ed.text.slice(ed.cur);
  ed.cur += s.length;
}
function wordLeft(i) {
  var t = ed.text;
  while (i > 0 && /\s/.test(t[i - 1])) i--;
  while (i > 0 && !/\s/.test(t[i - 1])) i--;
  return i;
}
function wordRight(i) {
  var t = ed.text;
  while (i < t.length && /\s/.test(t[i])) i++;
  while (i < t.length && !/\s/.test(t[i])) i++;
  return i;
}
function lineStart(i) {
  return ed.text.lastIndexOf('\n', i - 1) + 1;
}
function lineEnd(i) {
  var e = ed.text.indexOf('\n', i);
  return e < 0 ? ed.text.length : e;
}
function move(to, shift) {
  if (shift) {
    if (ed.anchor === null) ed.anchor = ed.cur;
  } else ed.anchor = null;
  ed.cur = Math.max(0, Math.min(ed.text.length, to));
}
function key(name, mods) {
  var n = name.toLowerCase(),
    ctrl =
      mods.indexOf('control') >= 0 ||
      mods.indexOf('super') >= 0 ||
      (mods.indexOf('alt') >= 0 && /left|right|backspace|delete/.test(n)),
    shift = mods.indexOf('shift') >= 0,
    r = sel(),
    col;
  if (n === 'return' || n === 'kp_enter' || n === 'enter') replaceSel('\n');
  else if (n === 'tab') replaceSel('\t');
  else if (n === 'space') replaceSel(' ');
  else if (n === 'backspace') {
    if (r) replaceSel('');
    else {
      var to = ctrl ? wordLeft(ed.cur) : ed.cur - 1;
      if (to >= 0) {
        ed.text = ed.text.slice(0, to) + ed.text.slice(ed.cur);
        ed.cur = to;
      }
    }
  } else if (n === 'delete') {
    if (r) replaceSel('');
    else {
      var e2 = ctrl ? wordRight(ed.cur) : ed.cur + 1;
      ed.text = ed.text.slice(0, ed.cur) + ed.text.slice(e2);
    }
  } else if (n === 'left') move(ctrl ? wordLeft(ed.cur) : r && !shift ? r[0] : ed.cur - 1, shift);
  else if (n === 'right') move(ctrl ? wordRight(ed.cur) : r && !shift ? r[1] : ed.cur + 1, shift);
  else if (n === 'home') move(ctrl ? 0 : lineStart(ed.cur), shift);
  else if (n === 'end') move(ctrl ? ed.text.length : lineEnd(ed.cur), shift);
  else if (n === 'up') {
    col = ed.cur - lineStart(ed.cur);
    var ps = lineStart(ed.cur);
    if (ps === 0) move(0, shift);
    else {
      var pps = lineStart(ps - 1);
      move(Math.min(pps + col, ps - 1), shift);
    }
  } else if (n === 'down') {
    col = ed.cur - lineStart(ed.cur);
    var le = lineEnd(ed.cur);
    if (le >= ed.text.length) move(ed.text.length, shift);
    else move(Math.min(le + 1 + col, lineEnd(le + 1)), shift);
  } else if (n === 'page_up' || n === 'prior') move(0, shift);
  else if (n === 'page_down' || n === 'next') move(ed.text.length, shift);
  else if (n === 'escape') ed.anchor = null;
  else if (ctrl && n === 'a') {
    ed.anchor = 0;
    ed.cur = ed.text.length;
  } else if (ctrl && (n === 'c' || n === 'x')) {
    if (r) {
      copy(ed.text.slice(r[0], r[1]));
      if (n === 'x') replaceSel('');
    }
  } else if (!ctrl && name.length === 1) replaceSel(shift ? name.toUpperCase() : name);
  else toast('Key command for another app: ' + (mods.length ? mods.join('+') + '+' : '') + name);
}
// Plover key combo syntax: names separated by spaces, modifiers wrap what they hold: Control_L(Shift_L(Left)) a b
function combo(str) {
  var toks = str.match(/[A-Za-z0-9_]+|\(|\)/g) || [],
    i = 0;
  (function run(mods) {
    while (i < toks.length) {
      var t = toks[i++];
      if (t === ')') return;
      if (t === '(') continue;
      if (toks[i] === '(') {
        i++;
        run(mods.concat([t.toLowerCase().replace(/_[lr]$/, '')]));
      } else key(t, mods);
    }
  })([]);
}
function applyOps(ops) {
  ops.forEach(function (op) {
    if (op[0] === 'bs') {
      if (sel()) replaceSel('');
      else {
        var n = Math.min(op[1], ed.cur);
        ed.text = ed.text.slice(0, ed.cur - n) + ed.text.slice(ed.cur);
        ed.cur -= n;
      }
    } else if (op[0] === 'str') replaceSel(op[1]);
    else if (op[0] === 'combo') combo(op[1]);
    else command(op[1]);
  });
}
function command(c) {
  var i = c.indexOf(':'),
    name = (i < 0 ? c : c.slice(0, i)).toLowerCase(),
    arg = i < 0 ? '' : c.slice(i + 1);
  // Plover has already run every other command itself
  if (name === 'lookup') openPrompt('lookup');
  else if (name === 'add_translation') openPrompt('add');
  else if (name === 'configure') {
    if (IME) NATIVE.openApp('settings');
    else show('settings', true);
  }
}
function copy(text) {
  NATIVE.copy(text);
  toast('Copied');
}
function renderPage() {
  var t = ed.text,
    r = sel(),
    C = '<span class="caret" id="caret"></span>';
  if (lesson) {
    renderLesson();
    return;
  }
  if (!t) {
    $('page').innerHTML =
      C +
      '<span class="coach"> ' +
      (stack().length
        ? 'Stroke something. The paper tape below shows what each stroke became.<button data-lesson="menu">Learn the sticks</button>'
        : 'No dictionaries are switched in. Tap the system name at the top to add some or restore the defaults.') +
      '</span>';
    return;
  }
  var html = r
    ? esc(t.slice(0, r[0])) +
      (ed.cur === r[0] ? C : '') +
      '<span class="sel">' +
      esc(t.slice(r[0], r[1])) +
      '</span>' +
      (ed.cur === r[1] ? C : '') +
      esc(t.slice(r[1]))
    : esc(t.slice(0, ed.cur)) + C + esc(t.slice(ed.cur));
  $('page').innerHTML = html;
  var c = $('caret');
  if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' });
}

/* ---------- paper tape ---------- */
function tapeLine(mask) {
  var s = '';
  for (var i = 0; i < KEYS.length; i++) s += mask & (1 << i) ? KEYS[i].replace('-', '') : ' ';
  return s;
}
var secret = false; // the keyboard is writing into a password box: show nothing of what is written
function renderTape(liveMask) {
  if (secret) {
    $('tape').innerHTML = '<div class="trow head"><span class="st">hidden while you write a password</span></div>';
    $('toast').textContent = '';
    pvShown = false;
    return;
  }
  var rows = tape.slice(-(liveMask ? Math.max(1, opt.tape - 1) : opt.tape)),
    html =
      '<div class="trow head"><span class="st">' +
      KEYS.map(function (k) {
        return k.replace('-', '');
      }).join('') +
      '</span><span class="tr">paper tape</span></div>';
  rows.forEach(function (r) {
    html +=
      '<div class="trow"><span class="st">' +
      esc(tapeLine(r.mask)) +
      '</span><span class="tr' +
      (r.undo ? ' u' : '') +
      '">' +
      esc(r.text) +
      '</span></div>';
  });
  if (liveMask)
    html +=
      '<div class="trow live"><span class="st">' +
      esc(tapeLine(liveMask)) +
      '</span><span class="tr">' +
      esc(stenoOf(liveMask)) +
      '</span></div>';
  $('tape').innerHTML = html;
  // under the tape, on the line messages use: what this stroke would become if you let go now. One line, however long
  var pv = liveMask && !lesson && !(panel && panel.field === 'strokes') ? preview(liveMask) : '',
    line = $('toast');
  if (pv && !toastOn) {
    line.textContent = '\u2192 ' + pv;
    line.className = 'toast pre';
    pvShown = true;
  } else if (pvShown) {
    line.textContent = '';
    line.className = 'toast';
    pvShown = false;
  }
}
function preview(mask) {
  // asked on every redraw while a chord is held, so the last answer is kept
  if (mask === pvMask) return pvText;
  pvMask = mask;
  pvText = '';
  try {
    var r = ask('preview', keysIn(mask));
    if (r)
      pvText = /^=undo/i.test(r.english || '')
        ? 'undo'
        : r.english == null
          ? 'no entry'
          : r.english + (r.rtfcre.length > 1 ? '   (' + r.rtfcre.join('/') + ')' : '');
  } catch (e) {}
  return pvText;
}

/* ---------- sending a stroke ---------- */
function send(mask) {
  if (!mask) return;
  pvMask = -1; // what the next stroke would become depends on this one
  if (lesson) {
    lessonStroke(mask);
    return;
  } // a lesson checks the stroke and types nothing
  var r;
  try {
    r = JSON.parse(
      NATIVE.stroke(
        JSON.stringify(
          KEYS.filter(function (k, i) {
            return mask & (1 << i);
          }),
        ),
        IME && !panel,
      ),
    );
    if (r.error) throw new Error(r.error);
    r = r.ok;
  } catch (e) {
    toast('That stroke hit an error: ' + e.message, true);
    return;
  }
  if (r.busy) {
    toast('The dictionaries are still loading');
    return;
  }
  if (panel)
    promptOps(r.ops); // into the panel's fields
  else if (IME)
    r.ops.forEach(function (op) {
      if (op[0] === 'cmd') command(op[1]);
    }); // the app has typed the rest into what you are writing in
  else applyOps(r.ops);
  var undo = r.steno === '*' && !(r.last && r.last.rtfcre[r.last.rtfcre.length - 1] === '*');
  var what = undo
    ? 'undo'
    : r.last
      ? r.last.english === null
        ? 'no entry'
        : r.last.rtfcre.join('/') + '  ' + r.last.english
      : '';
  tape.push({ mask: mask, text: what, undo: undo || (r.last && r.last.english === null) });
  if (tape.length > 60) tape.shift();
  if (!undo && r.last && r.last.english === null) buzz([30, 50, 30, 50, 30]); // no entry: three ticks, so a miss is felt without looking
  renderTape(0);
  renderPage();
  if (r.brief && opt.brief && !toastOn && !secret) {
    var line = $('toast');
    line.textContent = 'shorter: ' + r.brief;
    line.className = 'toast pre';
    pvShown = true;
  } // stays until the next touch
}

'use strict';
/* The basics every other file leans on: the bridge to the app, the settings and where they are kept, and the feedback a thumb can feel or hear. */

var $ = function (id) {
  return document.getElementById(id);
};
// Every setting. Lengths are CSS pixels, angles degrees, times milliseconds. NUMS below gives each number's range
var opt = {
  theme: 'system',
  hands: 2, // 2: a stick for each thumb. 1: one stick that a tap swaps between the left keys and the right
  dead: 30,
  far: 72,
  outer: 46,
  gap: 8,
  guard: 10,
  centre: 50,
  rolls: 'back',
  tap: true,
  tapr: 10,
  tapms: 350,
  wait: 700,
  vib: 65,
  vol: 0,
  height: 176,
  text: 20,
  tape: 2,
  hints: true,
  cap: false,
  arp: false,
  tiltL: 0,
  tiltR: 0,
  brief: true,
  v: 2,
}; // v: which set of defaults these are, for carrying old saved settings forward
var DEFAULTS = JSON.parse(JSON.stringify(opt));
// each number in Settings: key, the group it sits in, label, what it does, lowest, highest, step, unit
var NUMS = [
  [
    'dead',
    'numSticks',
    'Dead zone',
    'How far a thumb moves before anything counts. Raise it if keys go down that you did not mean.',
    6,
    100,
    1,
    'px',
  ],
  [
    'far',
    'numSticks',
    'Long push',
    'How far out the keys beyond the block begin. Raise it if short pushes keep going long, lower it if long ones are a stretch.',
    20,
    260,
    1,
    'px',
  ],
  [
    'outer',
    'numSticks',
    'Outer ring depth',
    'How far the stick reaches past the point where long begins. A shallower stick is cut less near a screen edge.',
    10,
    160,
    1,
    'px',
  ],
  [
    'gap',
    'numSticks',
    'Gaps between block keys',
    'Degrees at each edge of a block key that belong to no key: the lanes out to the single keys beyond. 0 closes them.',
    0,
    25,
    1,
    '\u00B0',
  ],
  [
    'guard',
    'numSticks',
    'Roll guard',
    'Degrees past a key\u2019s edge before a roll moves on to its neighbour. Raise it if a wobble adds keys.',
    0,
    30,
    1,
    '\u00B0',
  ],
  [
    'centre',
    'numSticks',
    'Centre for another push',
    'How near to where you landed counts as back at the centre, which ends one push so the next can start without lifting. A share of the dead zone.',
    10,
    100,
    5,
    '%',
  ],
  [
    'tiltL',
    'numSticks',
    'Left stick turn',
    'Degrees the left stick is turned clockwise, to match the way your left thumb really travels when you mean straight up. Fit the sticks sets it for you.',
    -45,
    45,
    1,
    '\u00B0',
  ],
  [
    'tiltR',
    'numSticks',
    'Right stick turn',
    'The same for the right thumb. Thumbs usually lean inward, so this one tends to come out negative.',
    -45,
    45,
    1,
    '\u00B0',
  ],
  [
    'tapr',
    'numTap',
    'Tap slop',
    'A tap may slide this far and still be a tap. No push counts inside it either.',
    2,
    40,
    1,
    'px',
  ],
  [
    'tapms',
    'numTap',
    'Tap time',
    'A tap lifts within this long. A thumb that rests longer and lifts does nothing.',
    80,
    2000,
    10,
    'ms',
  ],
  [
    'wait',
    'numTime',
    'Wait before sending',
    'How long you get to land a thumb again once both are off the glass. Most strokes take several pushes, so leave room for the gap between them; the line under the tape shows what is waiting to be sent. Lower it as you speed up.',
    40,
    3000,
    10,
    'ms',
  ],
  [
    'vib',
    'numFeel',
    'Vibration',
    'A tick for each key, a double one when a push goes long, a longer one when the stroke is sent. 0 is off.',
    0,
    100,
    1,
    '%',
  ],
  [
    'vol',
    'numFeel',
    'Sound',
    'A click for each key and a low double note when a push goes long. 0 is off.',
    0,
    100,
    1,
    '%',
  ],
  [
    'height',
    'numLook',
    'Pad height',
    'The sticks open wherever you land, and are cut to fit when that is near a screen edge.',
    60,
    500,
    2,
    'px',
  ],
  ['text', 'numLook', 'Text size', 'The writing on the page.', 12, 40, 1, 'px'],
  ['tape', 'numLook', 'Tape lines', 'How many past strokes the paper tape shows.', 1, 8, 1, ''],
];
var ed = { text: '', cur: 0, anchor: null };
var tape = [],
  ready = false;
/* This page is only the face of the app. Plover itself runs behind it (see app/src/main/python/rings) and NATIVE,
   which the app puts on the page, is how the page asks for things. IME: this copy of the page is the keyboard, not
   the app screen. */
var NATIVE = window.RingsNative,
  IME = NATIVE.mode() === 'ime';
var nat = { dicts: [], busy: true },
  natReady = null,
  panel = null; // nat: Plover's last report. panel: the open Look up / Add translation panel
if (IME) document.documentElement.classList.add('ime');
function ask(method) {
  var r = JSON.parse(NATIVE.call(method, JSON.stringify(Array.prototype.slice.call(arguments, 1))));
  if (r.error) throw new Error(r.error.replace(/^\w+Error: /, ''));
  return r.ok;
}
function natRefresh() {
  try {
    nat = ask('status');
  } catch (e) {
    toast(e.message, true, true);
    return;
  }
  if (nat.system) setSystem(nat.system); // empty until Plover has loaded its config
  wire();
  if ($('library').classList.contains('show')) drawLibrary();
  if (nat.busy) setTimeout(natRefresh, 300);
  else if (natReady) {
    natReady();
    natReady = null;
  }
}

/* ---------- small storage layer: IndexedDB when available, memory otherwise ---------- */
var mem = {},
  dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(function (res) {
    try {
      var r = indexedDB.open('rings-steno', 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore('kv');
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        res(null);
      };
    } catch (e) {
      res(null);
    }
  });
  return dbp;
}
function dbGet(k) {
  return db().then(function (d) {
    if (!d) return mem[k];
    return new Promise(function (res) {
      try {
        var q = d.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = function () {
          res(q.result);
        };
        q.onerror = function () {
          res(mem[k]);
        };
      } catch (e) {
        res(mem[k]);
      }
    });
  });
}
function dbSet(k, v) {
  mem[k] = v;
  return db().then(function (d) {
    if (!d) return;
    try {
      var s = d.transaction('kv', 'readwrite').objectStore('kv');
      if (v === undefined) s.delete(k);
      else s.put(v, k);
    } catch (e) {}
  });
}
function saveMeta() {
  var saved = Object.assign({}, opt);
  if (lesson && lesson.handsBefore) saved.hands = lesson.handsBefore; // a lesson has only borrowed one-thumb mode: do not keep it
  dbSet('meta', { opt: saved });
}

/* ---------- feedback ---------- */
// p: milliseconds for one tick, or [on, off, on] for the double tick that marks a long push
var ac = null;
function beep(hz, ms) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    var o = ac.createOscillator(),
      g = ac.createGain(),
      now = ac.currentTime;
    o.frequency.value = hz;
    g.gain.setValueAtTime((opt.vol / 100) * 0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + ms / 1000);
    o.connect(g);
    g.connect(ac.destination);
    o.start(now);
    o.stop(now + ms / 1000);
  } catch (e) {}
}
function buzz(p) {
  var two = Array.isArray(p) && p.length === 3,
    miss = Array.isArray(p) && p.length > 3;
  if (opt.vol) {
    beep(miss ? 150 : two ? 330 : p >= 14 ? 220 : 900, miss ? 160 : two ? 60 : 30);
    if (two)
      setTimeout(function () {
        beep(330, 60);
      }, 110);
  }
  NATIVE.haptic(miss ? 'miss' : two ? 'far' : p >= 14 ? 'sent' : p >= 6 ? 'key' : 'tick', opt.vib);
}
var toastTimer = 0,
  toastOn = false,
  pvShown = false,
  pvMask = -1,
  pvText = ''; // pv: the tape's preview of the stroke being built, shown on the message line when no message is up
function toast(msg, bad, sticky) {
  var t = $('toast');
  t.textContent = msg || '';
  t.className = 'toast' + (bad ? ' bad' : '');
  toastOn = !!msg;
  pvShown = false;
  clearTimeout(toastTimer);
  if (msg && !sticky)
    toastTimer = setTimeout(function () {
      t.textContent = '';
      toastOn = false;
    }, 3200);
}
function report(msg, bad) {
  var el = $('libStatus');
  el.textContent = msg || '';
  el.className = 'status' + (bad ? ' bad' : '');
  toast(msg, bad);
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

'use strict';
/* Lessons on the sticks, and fitting the sticks to the writer's thumbs. */

/* ---------- lessons ----------
   A short course on the sticks, shown on the page in place of the paper. Each step asks for a key, a stroke or a
   word; what you make on the pad is checked against it and never typed. The word lessons take their words and
   outlines from the dictionaries that are switched on, so they teach the system you actually have. */
var lesson = null; // null: writing. { menu: true }: the list. Else { n, items, i, typed, msg, ok, done }
var DIRS = {
  l: 'left',
  r: 'right',
  u: 'up',
  d: 'down',
  ul: 'up-left',
  ur: 'up-right',
  dl: 'down-left',
  dr: 'down-right',
};
var HOW = {},
  BLOCKKEY = {},
  FARKEY = {}; // key -> how to make it, in words
['l', 'r'].forEach(function (side) {
  var thumb = side === 'l' ? 'left thumb' : 'right thumb';
  BLOCK.order.forEach(function (d) {
    HOW[KEY[side][d]] = thumb + ', short push ' + DIRS[d];
    BLOCKKEY[KEY[side][d]] = side;
  });
  ['u', 'l', 'r', 'dl', 'dr', 'ul', 'ur'].forEach(function (d) {
    var k = KEY2[side][d];
    if (k.length === 1 && !FARKEY[k[0]]) {
      FARKEY[k[0]] = side;
      HOW[k[0]] = thumb + ', long push ' + DIRS[d];
    }
  });
});
HOW['S-'] = 'tap the left thumb, or long push left';
HOW['*'] = 'tap the right thumb, or left thumb long push right';
var WORDS =
  'the of and to in is it you that he was for on are with as his they be at one have this from or had by but what some we can out other were all there when up use your how said an each she which do their time if will way about many then them write would like so these her long make thing see him two has look more day could go come did number no most people my over know water than call first who may down side been now find'.split(
    ' ',
  );
function shuffled(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)),
      t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
function keysIn(mask) {
  return KEYS.filter(function (k, i) {
    return mask & (1 << i);
  });
}
var LESSONS = [
  {
    name: 'The left block',
    intro:
      'Rest your left thumb anywhere on the left half of the pad. Push a short way toward the lit key and lift. Watch the picture, not your thumb: it lights up with what you are holding.',
    keys: 'T P H K W R',
    again: true,
  },
  {
    name: 'The right block',
    intro: 'The same on the right half, with your right thumb.',
    keys: '-F -P -L -R -B -G',
    again: true,
  },
  {
    name: 'Taps',
    intro:
      'A quick tap, with no slide, is the middle of the stick: S on the left, the star on the right. The star on its own undoes your last stroke when you are writing.',
    keys: 'S * S *',
  },
  {
    name: 'Long pushes, left',
    intro:
      'Keep going past the block and you reach the outer ring. You feel a double tick when the push goes long. Straight down is both vowels.',
    keys: 'A O AO S # *',
    again: true,
    show: 'l',
  },
  {
    name: 'Long pushes, right',
    intro: 'The outer ring on the right: vowels below, the last four letters above and to the sides.',
    keys: 'E U EU -T -D -TD -S -Z',
    again: true,
  },
  {
    name: 'Short or long',
    intro:
      'The same direction gives a different key depending on how far you go. Lift early for the block, push through for the outer ring.',
    keys: 'K A W AO R O -R E -B EU -G U P # -P -TD',
  },
  {
    name: 'Several pushes, one stroke',
    intro:
      'Keys add up until both thumbs have been off the glass for a moment; a longer tick says the stroke has gone. Make each push straight after the last. If strokes leave before you finish, raise Wait before sending in Settings, or switch on Arpeggiate.',
    keys: 'K-B T-L KA WE KAT TOP HEB RUG',
  },
  {
    name: 'Rolls',
    intro:
      'For two keys that sit side by side, push to the first and roll your thumb round onto the second before you lift. Keep rolling, the way the keys read, for a third.',
    keys: 'TP PH KW WR TK HR -FP -PL -RB -BG TPH KWR -TS -DZ',
  },
  { name: 'Short words from your dictionaries', words: [1, 3] },
  { name: 'Longer words from your dictionaries', words: [4, 99] },
];
function lessonItems(L) {
  if (!L.words) {
    var list = L.keys.split(' ');
    if (L.again) list = list.concat(shuffled(list));
    return list.map(function (st) {
      return { mask: maskOfSteno(st), show: L.show };
    });
  }
  // every single-stroke way the current dictionaries write each common word, shortest first
  var found = {};
  WORDS.forEach(function (w) {
    try {
      ask('lookup', w).forEach(function (sug) {
        if (sug.text === w) found[w] = (found[w] || []).concat(sug.outlines);
      });
    } catch (e) {}
  });
  var items = [];
  Object.keys(found).forEach(function (w) {
    var outs = found[w]
      .filter(function (o) {
        return o.indexOf('/') < 0;
      })
      .sort(function (a, b) {
        return a.replace('-', '').length - b.replace('-', '').length;
      });
    if (!outs.length) return;
    var size = outs[0].replace('-', '').length,
      mask;
    try {
      mask = maskOfSteno(outs[0]);
    } catch (e) {
      return;
    }
    if (size >= L.words[0] && size <= L.words[1]) items.push({ word: w, outlines: outs, mask: mask });
  });
  return shuffled(items).slice(0, 10);
}
function startLesson(n) {
  var items = lessonItems(LESSONS[n]);
  lesson = { n: n, items: items, i: 0, typed: [], msg: '', ok: false, done: !items.length, empty: !items.length };
  resetChord();
  renderPage();
  refresh();
}
function lessonStroke(mask) {
  var it = lesson.items && lesson.items[lesson.i],
    got = stenoOf(mask);
  tape.push({ mask: mask, text: 'lesson', undo: false });
  if (tape.length > 60) tape.shift();
  renderTape(0);
  if (!it || lesson.done || lesson.ok) return;
  if (mask === it.mask || (it.word && it.outlines.indexOf(got) >= 0)) {
    lesson.ok = true;
    lesson.msg = '\u2713';
    renderPage();
    setTimeout(lessonNext, 600);
    return;
  }
  var missing = keysIn(it.mask & ~mask),
    extra = keysIn(mask & ~it.mask),
    why = '';
  missing.forEach(function (m) {
    extra.forEach(function (x) {
      if (BLOCKKEY[m] && FARKEY[x] === BLOCKKEY[m]) why = ' That push went long. Lift sooner, before the double tick.';
      else if (FARKEY[m] && BLOCKKEY[x] === FARKEY[m])
        why = ' That push stopped short. Keep going until the double tick.';
    });
  });
  function names(ks) {
    return ks
      .map(function (k) {
        return '<b>' + esc(k.replace('-', '')) + '</b>';
      })
      .join(' ');
  }
  lesson.msg =
    'You wrote <b>' +
    esc(got) +
    '</b>.' +
    (missing.length ? ' Missing ' + names(missing) + '.' : '') +
    (extra.length ? ' Not wanted: ' + names(extra) + '.' : '') +
    why;
  renderPage();
}
function lessonNext() {
  if (!lesson || lesson.menu) return;
  lesson.i++;
  lesson.ok = false;
  lesson.msg = '';
  if (lesson.i >= lesson.items.length) {
    lesson.done = true;
    if (!(opt.learned > lesson.n)) {
      opt.learned = lesson.n + 1;
      saveMeta();
    }
  }
  renderPage();
  refresh();
}
/* ---------- fitting the sticks to your thumbs ----------
   Twelve pushes straight up: short then long, three of each, with each thumb. They give how far your short and long
   pushes really go, which sets the dead zone and where long begins, and which way each thumb really travels when
   you mean up, which sets how far each stick is turned. */
var calib = null; // { step, got: [[direction, length] x3] x4, msg, done, before }
var CALIB = [
  ['l', 'short'],
  ['l', 'long'],
  ['r', 'short'],
  ['r', 'long'],
];
function startCalib() {
  lesson = { menu: true };
  calib = { step: 0, got: [[], [], [], []], msg: '', done: false };
  resetChord();
  renderPage();
  refresh();
}
function calibPush(side, dir, len) {
  if (!calib || calib.done) return;
  var want = CALIB[calib.step];
  if (len < 8) return; // a rest or a slip, not a push
  if (side !== want[0])
    calib.msg =
      'That was your ' +
      (side === 'l' ? 'left' : 'right') +
      ' thumb. This step is for the ' +
      (want[0] === 'l' ? 'left' : 'right') +
      '.';
  else {
    calib.msg = '';
    calib.got[calib.step].push([dir, len]);
    buzz(6);
    if (calib.got[calib.step].length >= 3) calib.step++;
    if (calib.step >= CALIB.length) calibDone();
  }
  renderPage();
}
function calibDone() {
  function mid(step) {
    var a = calib.got[step]
      .map(function (q) {
        return q[1];
      })
      .sort(function (x, y) {
        return x - y;
      });
    return a[1];
  } // the middle of the three
  function turn(list) {
    var sx = 0,
      sy = 0;
    list.forEach(function (q) {
      sx += Math.cos((q[0] * Math.PI) / 180);
      sy += Math.sin((q[0] * Math.PI) / 180);
    });
    return Math.max(-45, Math.min(45, Math.round(((angle(sx, sy) - 270 + 540) % 360) - 180)));
  }
  var short = (mid(0) + mid(2)) / 2,
    long = (mid(1) + mid(3)) / 2;
  if (long < short * 1.4) {
    calib = {
      step: 0,
      got: [[], [], [], []],
      done: false,
      msg:
        'Your long pushes came out about as long as your short ones (' +
        Math.round(long) +
        ' and ' +
        Math.round(short) +
        ' px), so there was nothing to tell them apart by. Go again with a clear difference.',
    };
    return;
  }
  calib.before = { dead: opt.dead, far: opt.far, outer: opt.outer, tiltL: opt.tiltL, tiltR: opt.tiltR };
  opt.far = Math.round(Math.sqrt(short * long)); // long begins midway, by ratio, between your two lengths
  opt.dead = Math.round(Math.max(10, Math.min(opt.far - 12, short * 0.45))); // a short push clears the dead zone twice over
  opt.outer = Math.round(Math.max(24, Math.min(140, long - opt.far + 24)));
  opt.tiltL = turn(calib.got[0].concat(calib.got[1]));
  opt.tiltR = turn(calib.got[2].concat(calib.got[3]));
  calib.done = true;
  saveMeta();
  applyOpts();
}
function renderCalib() {
  var h,
    c = calib;
  if (c.done) {
    h =
      '<h2>The sticks are fitted</h2><p>From your pushes: nothing counts for the first <b>' +
      opt.dead +
      ' px</b>, and a push goes long at <b>' +
      opt.far +
      ' px</b>. The left stick is turned <b>' +
      opt.tiltL +
      '\u00B0</b> and the right <b>' +
      opt.tiltR +
      '\u00B0</b>, so that the way each thumb really moves is straight up. Try a few strokes; every number is in Settings if you want to nudge one.</p>' +
      '<div class="row"><button class="go" data-lesson="calib-keep">Keep these</button><button data-lesson="calib-undo">Put it back</button></div>';
  } else {
    var w = CALIB[c.step],
      n = c.got[c.step].length;
    h =
      '<div class="top"><span>Fit the sticks \u00B7 step ' +
      (c.step + 1) +
      ' of 4</span><button data-lesson="calib-cancel">Cancel</button></div>' +
      '<h2>' +
      (w[0] === 'l' ? 'Left' : 'Right') +
      ' thumb: a ' +
      w[1] +
      ' push straight up</h2>' +
      '<p>' +
      (w[1] === 'short'
        ? 'A small push, the size you would use for a key in the block.'
        : 'A big push, the size you would use to reach past the block.') +
      ' Three times, lifting between each. Do it the way you would when writing, without watching your thumb: the point is to measure what your thumb does on its own.</p>' +
      '<div class="goal">' +
      '\u25CF'.repeat(n) +
      '\u25CB'.repeat(3 - n) +
      '</div><div class="msg' +
      (c.msg ? ' bad' : '') +
      '">' +
      esc(c.msg || '') +
      '</div>';
  }
  $('page').innerHTML = '<div class="lesson">' + h + '</div>';
}
function renderLesson() {
  var h,
    sides = '';
  if (calib) {
    renderCalib();
    return;
  }
  if (lesson.menu) {
    h =
      '<h2>Learn the sticks</h2><p>Short lessons, best taken in order. Each step asks for a key or a stroke: make it on the pad below and you are told what you got. Nothing you write in a lesson is typed anywhere.</p>' +
      '<button data-lesson="calib">Before you start: fit the sticks to your thumbs</button>' +
      LESSONS.map(function (L, i) {
        return (
          '<button data-lesson="' +
          i +
          '">' +
          (opt.learned > i ? '\u2713 ' : '') +
          (i + 1) +
          '. ' +
          esc(L.name) +
          '</button>'
        );
      }).join('') +
      '<button data-lesson="exit" class="quiet">Back to writing</button>';
  } else {
    var L = LESSONS[lesson.n],
      it = lesson.items[lesson.i],
      top =
        '<div class="top"><span>Lesson ' +
        (lesson.n + 1) +
        ' of ' +
        LESSONS.length +
        ': ' +
        esc(L.name) +
        (lesson.done ? '' : ' \u00B7 ' + (lesson.i + 1) + '/' + lesson.items.length) +
        '</span>';
    if (lesson.done) {
      h =
        top +
        '</div><h2>' +
        (lesson.empty ? 'No words to practise yet' : 'That lesson is done') +
        '</h2><p>' +
        (lesson.empty
          ? 'None of the common words has a one-stroke entry of this size in the dictionaries that are switched on. Add or switch on dictionaries and come back.'
          : 'Take it again whenever you like: the order changes each time.') +
        '</p><div class="row">' +
        (lesson.n + 1 < LESSONS.length
          ? '<button class="go" data-lesson="' +
            (lesson.n + 1) +
            '">Next: ' +
            esc(LESSONS[lesson.n + 1].name) +
            '</button>'
          : '') +
        '<button data-lesson="menu">All lessons</button></div>';
    } else {
      var ks = keysIn(it.mask);
      sides =
        it.show ||
        (ks.some(function (k) {
          return BLOCKKEY[k] === 'l' || FARKEY[k] === 'l';
        })
          ? 'l'
          : '') +
          (ks.some(function (k) {
            return BLOCKKEY[k] === 'r' || FARKEY[k] === 'r' || (k === '*' && !it.show);
          })
            ? 'r'
            : '');
      h =
        top +
        '<button data-lesson="skip">Skip</button><button data-lesson="menu">Lessons</button></div>' +
        (lesson.i === 0 && L.intro ? '<p>' + esc(L.intro) + '</p>' : '') +
        '<div class="goal">' +
        esc(it.word || stenoOf(it.mask)) +
        (it.word ? '<small>written ' + esc(it.outlines[0]) + '</small>' : '') +
        '</div>' +
        '<ul>' +
        ks
          .map(function (k) {
            return '<li><b>' + esc(k.replace('-', '')) + '</b> ' + HOW[k] + '</li>';
          })
          .join('') +
        '</ul>' +
        '<div class="demo">' +
        ['l', 'r']
          .map(function (sd) {
            var use = sides.indexOf(sd) >= 0;
            return (
              '<div class="hand ' +
              sd +
              (use ? '' : ' idle') +
              '"><b>' +
              (sd === 'l' ? 'Left thumb' : 'Right thumb') +
              '</b><div class="ring demo ' +
              sd +
              '" data-side="' +
              sd +
              '"' +
              (use ? ' data-use="1"' : '') +
              '></div></div>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="msg' +
        (lesson.ok ? ' ok' : lesson.msg ? ' bad' : '') +
        '">' +
        lesson.msg +
        '</div>';
    }
  }
  $('page').innerHTML = '<div class="lesson">' + h + '</div>';
  $('page').scrollTop = 0;
  if (sides)
    document.querySelectorAll('.ring.demo').forEach(function (el) {
      drawRing(
        el,
        el.dataset.side,
        function () {
          return 1;
        },
        tiltOf(el.dataset.side),
      );
      var R = RV() + 4;
      el.firstChild.setAttribute('viewBox', -R + ' ' + -R + ' ' + 2 * R + ' ' + 2 * R);
      el.querySelectorAll('[data-k]').forEach(function (n) {
        n.classList.toggle('want', !!el.dataset.use && !!(lesson.items[lesson.i].mask & BIT[n.dataset.k]));
      });
    });
}
$('page').addEventListener('click', function (e) {
  var b = e.target.closest('[data-lesson]');
  if (!b) return;
  var what = b.dataset.lesson;
  if (what === 'calib') {
    startCalib();
    return;
  }
  if (what === 'calib-cancel' || what === 'calib-keep') {
    calib = null;
    renderPage();
    refresh();
    return;
  }
  if (what === 'calib-undo') {
    for (var key in calib.before) opt[key] = calib.before[key];
    calib = null;
    saveMeta();
    applyOpts();
    renderPage();
    return;
  }
  if (what === 'exit') {
    lesson = null;
    renderPage();
    refresh();
  } else if (what === 'menu') {
    lesson = { menu: true };
    renderPage();
    refresh();
  } else if (what === 'skip') lessonNext();
  else startLesson(+what);
});
$('btnLearn').addEventListener('click', function () {
  show('guide', false);
  lesson = { menu: true };
  renderPage();
});

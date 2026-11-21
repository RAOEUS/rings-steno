'use strict';
/* The two thumb sticks: reading touches into steno keys. */

/* ---------- the sticks ----------
   One floating stick for each thumb: it opens wherever the thumb lands on its half, so there is nothing to aim at.
   Each stick is a small copy of its hand's side of the board. A short push works the block of six, laid out as on the
   board and as on plover_controller. A long push, on past the block, works the
   keys that sit beyond it on the board: the number bar above, the side keys, the vowels underneath. A quick tap is the stick's click.
   Dead zones keep slips out: the centre, the gaps between the block's keys, the way back in from a long
   push, and the edges between keys in a roll. Near a screen edge the stick squashes on that side so it always fits. */
function RV() {
  return opt.far + opt.outer;
} // drawn edge of the outer ring. opt.dead is the centre dead zone, opt.far where a long push begins
// How much of the stick fits in each direction (degrees) from where the thumb landed, in window coordinates: 1 is
// full size. The stick is cut off flat by a screen edge. A direction that runs into an edge gets exactly the travel
// there is room for; every other direction stays full size; every key keeps its true direction and its width.
function fit(x, y) {
  var W = window.innerWidth,
    H = window.innerHeight,
    rv = RV();
  return function (deg) {
    var a = (deg * Math.PI) / 180,
      c = Math.cos(a),
      n = Math.sin(a),
      room = Infinity;
    if (c > 1e-6) room = (W - x) / c;
    else if (c < -1e-6) room = x / -c;
    if (n > 1e-6) room = Math.min(room, (H - y) / n);
    else if (n < -1e-6) room = Math.min(room, y / -n);
    return Math.max(0.05, Math.min(1, (room - 4) / rv));
  };
}
// wedges by screen angle, clockwise from east: c = centre, w = half width. The six of BLOCK are plover_controller's.
var BLOCK = {
  order: ['dr', 'd', 'dl', 'ul', 'u', 'ur'],
  dr: { c: 30, w: 30 },
  d: { c: 90, w: 30 },
  dl: { c: 150, w: 30 },
  ul: { c: 210, w: 30 },
  u: { c: 270, w: 30 },
  ur: { c: 330, w: 30 },
};
var AROUND = {
  order: ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur'],
  r: { c: 0, w: 30 },
  dr: { c: 50, w: 20 },
  d: { c: 90, w: 20 },
  dl: { c: 130, w: 20 },
  l: { c: 180, w: 30 },
  ul: { c: 230, w: 20 },
  u: { c: 270, w: 20 },
  ur: { c: 310, w: 20 },
};
var KEY = {
  l: { dr: 'R-', d: 'W-', dl: 'K-', ul: 'T-', u: 'P-', ur: 'H-' },
  r: { dr: '-G', d: '-B', dl: '-R', ul: '-F', u: '-P', ur: '-L' },
};
var KEY2 = {
  l: { l: ['S-'], ul: ['#'], u: ['#'], ur: ['#'], r: ['*'], dr: ['O-'], d: ['A-', 'O-'], dl: ['A-'] },
  r: { l: ['-S'], ul: ['-T'], u: ['-T', '-D'], ur: ['-D'], r: ['-Z'], dr: ['-U'], d: ['-E', '-U'], dl: ['-E'] },
};
function maskOf(keys) {
  var m = 0;
  keys.forEach(function (k) {
    m |= BIT[k];
  });
  return m;
}
// The keys one trip means. opt.rolls picks the rule for a roll:
//   back   every key the thumb crossed; crossing one a second time takes it out again, so T, P, H and back onto P is TH
//   steno  plover_controller's table for the block: with steno order keeps every key, against it keeps only the two ends
//   all    every key the thumb crossed, whatever it did after
function resolve(t, path) {
  var m = 0,
    table = t.set === 2 ? KEY2[t.side] : KEY[t.side],
    times = {};
  if (opt.rolls === 'steno' && t.set !== 2) {
    var hit = STICKMAP[t.side][path.join(',')];
    if (hit != null) return hit;
  }
  path.forEach(function (d) {
    times[d] = (times[d] || 0) + 1;
  });
  Object.keys(times).forEach(function (d) {
    if (opt.rolls !== 'back' || times[d] % 2) m |= maskOf([].concat(table[d]));
  });
  return m;
}
// the stick as drawn for one touch. k(deg) is its scale in that direction: see fit()
function tiltOf(side) {
  return side === 'l' ? opt.tiltL : opt.tiltR;
}
function drawRing(el, side, k, tilt) {
  var r0 = opt.dead,
    r1 = opt.far,
    r2 = RV(),
    g = '<svg viewBox="-150 -150 300 300">';
  function P(deg, rad) {
    var on = deg + (tilt || 0),
      a = (on * Math.PI) / 180,
      z = rad * k(on);
    return [z * Math.cos(a), z * Math.sin(a)];
  } // on: where that direction lies on the screen once the stick is turned
  function loop(cls, rad) {
    var d = '';
    for (var a = 0; a < 360; a += 5) {
      var q = P(a, rad);
      d += (a ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    }
    return '<path class="' + cls + '" d="' + d + 'Z"/>';
  }
  function spoke(deg, a0, a1) {
    var q = P(deg, a0),
      w = P(deg, a1);
    return '<line class="spoke" x1="' + q[0] + '" y1="' + q[1] + '" x2="' + w[0] + '" y2="' + w[1] + '"/>';
  }
  function label(key, deg, rad) {
    var q = P(deg, rad),
      z = Math.max(0.55, k(deg + (tilt || 0)));
    return (
      '<circle class="lit" data-k="' +
      key +
      '" cx="' +
      q[0] +
      '" cy="' +
      q[1] +
      '" r="' +
      17 * z +
      '"/><text data-k="' +
      key +
      '" style="font-size:' +
      19 * z +
      'px" x="' +
      q[0] +
      '" y="' +
      (q[1] + (key === '*' ? 5 * z : 0)) +
      '">' +
      key.replace('-', '') +
      '</text>'
    );
  }
  g += loop('outer', r2) + loop('inner', r1);
  BLOCK.order.forEach(function (id) {
    g += spoke(BLOCK[id].c - 30, r0, r1) + label(KEY[side][id], BLOCK[id].c, (r0 + r1) / 2);
  });
  [30, 70, 110, 150, 210, 330].concat(side === 'l' ? [] : [250, 290]).forEach(function (d) {
    g += spoke(d, r1, r2);
  });
  var beyond =
    side === 'l'
      ? { '#': 270, 'S-': 180, '*': 0, 'A-': 130, 'O-': 50 }
      : { '-T': 230, '-D': 310, '-S': 180, '-Z': 0, '-E': 130, '-U': 50 };
  for (var key in beyond) g += label(key, beyond[key], (r1 + r2) / 2);
  el.innerHTML =
    g +
    loop('dead', r0) +
    (opt.hands === 1
      ? '<text class="hub" x="0" y="0">' + (side === 'l' ? 'L' : 'R') + '</text>' // one thumb: which hand's keys this is
      : '<text class="hub" data-k="' +
        (side === 'l' ? 'S-' : '*') +
        '" x="0" y="' +
        (side === 'l' ? 0 : 5) +
        '">' +
        (side === 'l' ? 'S' : '*') +
        '</text>') +
    '</svg>';
}
function drawMaps(side) {
  var K = KEY[side];
  function cell(k) {
    return k ? '<span data-k="' + k + '">' + k.replace('-', '') + '</span>' : '<span></span>';
  }
  var block = [K.ul, K.u, K.ur, K.dl, K.d, K.dr].map(cell).join('');
  var around = (
    side === 'l'
      ? [null, '#', null, 'S-', null, '*', 'A-', null, 'O-']
      : ['-T', null, '-D', '-S', null, '-Z', '-E', null, '-U']
  )
    .map(cell)
    .join('');
  $(side === 'l' ? 'mapsL' : 'mapsR').innerHTML =
    '<div class="mapwrap one"><div class="map">' +
    block +
    '</div><small>short push</small>' +
    (opt.hands === 1
      ? '<small class="tap">tap = ' + (side === 'l' ? 'right keys' : 'left keys') + '</small>'
      : opt.tap
        ? '<small class="tap">tap = <b data-k="' +
          (side === 'l' ? 'S-' : '*') +
          '">' +
          (side === 'l' ? 'S' : '*') +
          '</b></small>'
        : '') +
    '</div><div class="mapwrap two"><div class="map' +
    (side === 'l' ? '' : ' wide') +
    '">' +
    around +
    '</div><small>long push</small></div>';
}
function placeGhosts() {
  drawMaps('l');
  drawMaps('r');
  refresh();
}
var deck = $('deck'),
  foot = $('foot'),
  touches = {},
  chord = 0,
  hist = [],
  sendTimer = 0;
// One thumb (opt.hands === 1): a single stick over the whole pad. It is on one hand's keys at a time, starts every
// stroke on the left, and a quick tap swaps it to the other hand.
var hand = 'l';
function pending() {
  var m = 0;
  for (var id in touches) m |= resolve(touches[id], touches[id].path);
  return m;
}
function refresh() {
  var m = chord | pending();
  (lesson ? document : deck).querySelectorAll('#deck [data-k], .ring.demo [data-k]').forEach(function (n) {
    n.classList.toggle('on', !!(m & BIT[n.dataset.k]));
  }); // the lesson's pictures light up with your thumbs
  var one = opt.hands === 1;
  deck.classList.toggle('one', one);
  deck.classList.toggle('right', one && hand === 'r');
  $('mapsL').classList.toggle('away', one && hand !== 'l');
  $('mapsR').classList.toggle('away', one && hand !== 'r');
  document.querySelectorAll('.lesson .hand').forEach(function (h) {
    h.classList.toggle('now', one && h.classList.contains(hand));
  });
  $('arpBack').disabled = !hist.length;
  $('arpClear').disabled = !chord;
  $('arpSend').disabled = !chord;
  renderTape(m);
}
function press(mask) {
  if (opt.arp && mask) hist.push(chord);
  if (opt.arp && mask && !(mask & ~chord)) {
    chord &= ~mask;
    buzz(6);
    return;
  } // arpeggiating: pushing a key that is already down takes it out
  if (mask & ~chord) buzz(6);
  chord |= mask;
}
function sendNow() {
  var m = chord;
  chord = 0;
  hist = [];
  if (m) hand = 'l'; // one thumb: the stick goes back to the left once a stroke has gone. A tap on its own keeps, however long you take
  refresh();
  if (m) {
    buzz(14);
    send(m);
  }
} // the longer tick: that stroke has gone, the next can start
function resetChord() {
  clearTimeout(sendTimer);
  chord = 0;
  hist = [];
  hand = 'l';
}
function closePath(t) {
  if (!t.path.length) return;
  press(resolve(t, t.path));
  t.set = 1;
  t.path = [];
  t.cur = null;
  t.locked = false;
  t.did = true;
}
function off(a, c) {
  return Math.abs(((a - c + 540) % 360) - 180);
}
// which key of a ring the angle a points at. gap: degrees at each edge that belong to no key until one is already held
function wedge(tab, cur, a, gap) {
  if (cur != null && off(a, tab[cur].c) <= tab[cur].w + opt.guard) return cur;
  for (var i = 0; i < tab.order.length; i++)
    if (off(a, tab[tab.order[i]].c) <= tab[tab.order[i]].w - (cur == null ? gap : 0)) return tab.order[i];
  return cur;
}
function angle(dx, dy) {
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}
function track(t, x, y) {
  var raw = Math.hypot(x - t.cx, y - t.cy),
    on = angle(x - t.cx, y - t.cy),
    ang = (on - tiltOf(t.side) + 360) % 360; // on: the direction on the screen. ang: the same on the stick, which may be turned to suit the thumb
  var r = raw / t.k(on),
    dead = opt.dead,
    far = opt.far,
    wentFar = false;
  if (raw > t.maxR) t.maxR = raw;
  if (r < (dead * opt.centre) / 100) {
    if (t.path.length) {
      closePath(t);
      refresh();
    }
    return;
  } // back at the centre: that trip is done, the next one starts fresh
  if (raw < opt.tapr) return; // no push counts inside the tap's own slop, however hard the stick is cut against an edge
  if (t.set === 1 && t.path.length < 2 && r >= far) {
    t.set = 2;
    t.path = [];
    t.cur = null;
    t.locked = false;
    wentFar = true;
  } // on past the block before any roll: this trip is the keys beyond it, in place of any near one
  if (r < (t.set === 2 ? far * 0.75 : dead)) return; // dead zones: around the centre, and on the way back in from a long push
  var s = wedge(t.set === 2 ? AROUND : BLOCK, t.cur, ang, t.set === 2 ? 0 : opt.gap);
  if (s != null && s !== t.cur) {
    if (t.path.length === 1 && !t.locked)
      t.path[0] = s; // still settling on a direction, not a roll
    else if (t.path[t.path.length - 1] !== s) t.path.push(s);
    t.cur = s;
    buzz(wentFar ? [10, 40, 10] : 4);
    refresh();
  }
  if (r >= (t.set === 2 ? far * 1.12 : dead * 1.5)) t.locked = true;
}
foot.addEventListener('pointerdown', function (e) {
  if (!ready) return;
  var act = e.target.closest && e.target.closest('[data-arp],[data-do]');
  if (act && act.dataset.do) {
    e.preventDefault();
    buzz(6);
    doAct(act.dataset.do);
    return;
  }
  var q = e.target.closest && e.target.closest('[data-q]');
  if (q) {
    e.preventDefault();
    buzz(4);
    typeKey(q.dataset.q);
    return;
  }
  if (e.target.closest && e.target.closest('#prompt,#setup')) return;
  if (calib && !calib.done) {
    // fitting the sticks: only measure the push
    e.preventDefault();
    try {
      foot.setPointerCapture(e.pointerId);
    } catch (err) {}
    var dk = deck.getBoundingClientRect();
    touches[e.pointerId] = {
      calib: true,
      side: e.clientX - dk.left < dk.width / 2 ? 'l' : 'r',
      cx: e.clientX,
      cy: e.clientY,
      maxR: 0,
      a: 0,
    };
    return;
  }
  if (act) {
    // arpeggiate: Send is the space bar, Back undoes the last push, Clear empties the stroke (Back brings it back)
    e.preventDefault();
    if (act.disabled) return;
    if (act.dataset.arp === 'send') {
      sendNow();
      return;
    }
    if (act.dataset.arp === 'back') chord = hist.pop() || 0;
    else {
      hist.push(chord);
      chord = 0;
    }
    buzz(8);
    refresh();
    return;
  }
  e.preventDefault();
  try {
    foot.setPointerCapture(e.pointerId);
  } catch (err) {}
  var d = deck.getBoundingClientRect(),
    x = e.clientX - d.left,
    y = e.clientY - d.top,
    side = opt.hands === 1 ? hand : x < d.width / 2 ? 'l' : 'r';
  for (var o in touches) if (touches[o].side === side) return; // one thumb per side
  clearTimeout(sendTimer);
  var t = {
    side: side,
    set: 1,
    cx: x,
    cy: y,
    k: fit(e.clientX, e.clientY),
    t0: performance.now(),
    maxR: 0,
    path: [],
    cur: null,
    locked: false,
    did: false,
  }; // set: 1 the block, 2 the keys beyond it
  touches[e.pointerId] = t;
  t.mark = $(side === 'l' ? 'ringL' : 'ringR');
  drawRing(t.mark, side, t.k, tiltOf(side));
  t.mark.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  t.mark.classList.add('show');
  $(side === 'l' ? 'mapsL' : 'mapsR').classList.add('hide');
  refresh();
});
foot.addEventListener('pointermove', function (e) {
  var t = touches[e.pointerId];
  if (!t) return;
  if (t.calib) {
    var far = Math.hypot(e.clientX - t.cx, e.clientY - t.cy);
    if (far > t.maxR) {
      t.maxR = far;
      t.a = angle(e.clientX - t.cx, e.clientY - t.cy);
    }
    return;
  }
  var d = deck.getBoundingClientRect();
  track(t, e.clientX - d.left, e.clientY - d.top);
});
function lift(e) {
  var t = touches[e.pointerId];
  if (!t) return;
  if (t.calib) {
    delete touches[e.pointerId];
    if (e.type === 'pointerup') calibPush(t.side, t.a, t.maxR);
    return;
  }
  if (e.type === 'pointercancel') {
    t.path = [];
    t.did = true;
  } // the phone took the touch away (a system gesture, say): whatever it was on its way to is not added
  if (e.type === 'pointerup') {
    var d = deck.getBoundingClientRect();
    track(t, e.clientX - d.left, e.clientY - d.top);
  } // where the thumb left the glass counts: the last move can lag a fast push
  if (t.path.length) closePath(t);
  else if (!t.did && e.type === 'pointerup' && t.maxR < opt.tapr && performance.now() - t.t0 < opt.tapms) {
    // a quick tap. A rest, or a slide that never left the dead zone, is nothing
    if (opt.hands === 1) {
      hand = hand === 'l' ? 'r' : 'l'; // one thumb: it swaps the stick to the other hand's keys
      buzz(hand === 'r' ? [10, 40, 10] : 6); // two ticks: now on the right. One: back on the left
    } else if (opt.tap) press(BIT[t.side === 'l' ? 'S-' : '*']); // two thumbs: it is the stick's click
  }
  delete touches[e.pointerId];
  t.mark.classList.remove('show');
  $(t.side === 'l' ? 'mapsL' : 'mapsR').classList.remove('hide');
  refresh();
  if (!Object.keys(touches).length && !opt.arp) {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(sendNow, opt.wait);
  }
}
foot.addEventListener('pointerup', lift);
foot.addEventListener('pointercancel', lift);
['touchstart', 'touchmove', 'contextmenu', 'gesturestart', 'selectstart'].forEach(function (n) {
  foot.addEventListener(
    n,
    function (e) {
      e.preventDefault();
    },
    { passive: false },
  );
});

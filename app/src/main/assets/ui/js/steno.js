'use strict';
/* Steno keys and strokes. A stroke is a bit mask over KEYS, which are in steno order. */

var KEYS = [
  '#',
  'S-',
  'T-',
  'K-',
  'P-',
  'W-',
  'H-',
  'R-',
  'A-',
  'O-',
  '*',
  '-E',
  '-U',
  '-F',
  '-R',
  '-P',
  '-B',
  '-L',
  '-G',
  '-T',
  '-S',
  '-D',
  '-Z',
];
var BIT = {};
KEYS.forEach(function (key, i) {
  BIT[key] = 1 << i;
});

// Systems whose number bar turns other keys into digits when written out. Lapwing keeps # as a key of its own.
var NUMBER_BAR = {
  'English Stenotype': {
    'S-': '1',
    'T-': '2',
    'P-': '3',
    'H-': '4',
    'A-': '5',
    'O-': '0',
    '-F': '6',
    '-P': '7',
    '-L': '8',
    '-T': '9',
  },
};
var digits = {}; // for the system in use
var FIRST_RIGHT = KEYS.indexOf('-E'),
  AFTER_VOWELS = KEYS.indexOf('-U') + 1;
var MIDDLE = BIT['A-'] | BIT['O-'] | BIT['*'] | BIT['-E'] | BIT['-U']; // with any of these a stroke needs no hyphen
var RIGHT = 0;
KEYS.forEach(function (key, i) {
  if (i >= FIRST_RIGHT) RIGHT |= 1 << i;
});

function setSystem(name) {
  digits = NUMBER_BAR[name] || {};
}

// a stroke as steno writes it: "KAT", "-T", "12" on a system with a number bar
function stenoOf(mask) {
  var out = '',
    numbers =
      mask & 1 &&
      KEYS.some(function (key, i) {
        return digits[key] && mask & (1 << i);
      });
  var hyphen = mask & RIGHT && !(mask & MIDDLE);
  if (mask & 1 && !numbers) out += '#';
  for (var i = 1; i < KEYS.length; i++) {
    if (!(mask & (1 << i))) continue;
    if (hyphen && i >= FIRST_RIGHT) {
      out += '-';
      hyphen = false;
    }
    out += numbers && digits[KEYS[i]] ? digits[KEYS[i]] : KEYS[i].replace('-', '');
  }
  return out;
}

// the other way: "KAT" to its mask. Throws on anything that is not a stroke in steno order.
function maskOfSteno(steno) {
  var mask = 0,
    from = 1;
  for (var c = 0; c < steno.length; c++) {
    var ch = steno[c],
      found = -1;
    if (ch === '#') {
      mask |= 1;
      continue;
    }
    if (ch === '-') {
      if (from > AFTER_VOWELS) throw new Error('bad steno');
      from = AFTER_VOWELS;
      continue;
    }
    var digitKey = Object.keys(digits).filter(function (key) {
      return digits[key] === ch;
    })[0];
    if (digitKey) mask |= 1;
    for (var i = from; i < KEYS.length; i++)
      if (digitKey ? KEYS[i] === digitKey : KEYS[i].replace('-', '') === ch) {
        found = i;
        break;
      }
    if (found < 0) throw new Error('bad steno');
    mask |= 1 << found;
    from = found + 1;
  }
  return mask;
}

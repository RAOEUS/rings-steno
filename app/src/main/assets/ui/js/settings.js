'use strict';
/* The Settings and guide panels. */

/* ---------- panels and settings ---------- */
function show(id, on) {
  $(id).classList.toggle('show', on);
}
$('btnSys').addEventListener('click', openLibrary);
$('btnLookup').addEventListener('click', openLookup);
$('btnGuide').addEventListener('click', function () {
  show('guide', true);
});
$('btnSettings').addEventListener('click', function () {
  show('settings', true);
});
$('btnCopy').addEventListener('click', function () {
  if (ed.text) copy(ed.text);
  else toast('Nothing to copy yet');
});
document.querySelectorAll('.scrim').forEach(function (s) {
  s.addEventListener('click', function (e) {
    if (e.target === s || e.target.closest('[data-close]')) s.classList.remove('show');
  });
});
// light or dark. "system" asks the phone
function applyTheme() {
  document.documentElement.dataset.theme =
    opt.theme === 'light' || opt.theme === 'dark' ? opt.theme : NATIVE.night() ? 'dark' : 'light';
}
function applyOpts() {
  applyTheme();
  document.documentElement.style.setProperty('--navb', NATIVE.navInset() + 'px'); // stay clear of the phone's gesture bar
  document.querySelectorAll('#rollSeg button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.r === opt.rolls ? 'true' : 'false');
  });
  document.querySelectorAll('#themeSeg button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.th === opt.theme ? 'true' : 'false');
  });
  $('optArp').checked = opt.arp;
  $('deck').classList.toggle('arp', !!opt.arp);
  if (typeof resetChord === 'function') resetChord();
  $('optHints').checked = opt.hints;
  $('optTap').checked = opt.tap;
  $('optCap').checked = opt.cap;
  $('optBrief').checked = opt.brief;
  NUMS.forEach(function (n) {
    // keep every number inside its range, and its slider and box in step
    var v = +opt[n[0]];
    if (!isFinite(v)) v = DEFAULTS[n[0]];
    opt[n[0]] = Math.min(n[5], Math.max(n[4], Math.round(v / n[6]) * n[6]));
  });
  opt.far = Math.max(opt.far, opt.dead + 10); // a long push has to be clearly longer than the dead zone
  NUMS.forEach(function (n) {
    document.querySelectorAll('[data-n="' + n[0] + '"]').forEach(function (el) {
      el.value = opt[n[0]];
    });
  });
  $('app').style.setProperty('--deckh', opt.height + 'px');
  $('app').style.setProperty('--fs', opt.text + 'px');
  $('app').style.setProperty('--lh', Math.round(opt.text * 1.5) + 'px');
  $('app').classList.toggle('nohints', !opt.hints);
  placeGhosts();
}
[
  ['optHints', 'hints'],
  ['optTap', 'tap'],
  ['optCap', 'cap'],
  ['optArp', 'arp'],
  ['optBrief', 'brief'],
].forEach(function (p) {
  $(p[0]).addEventListener('change', function (e) {
    opt[p[1]] = e.target.checked;
    saveMeta();
    applyOpts();
  });
});
// one slider and one number box for each entry of NUMS. The slider acts as it moves; the box when you leave it, so
// a half-typed number is never clamped under your fingers
NUMS.forEach(function (n) {
  $(n[1]).insertAdjacentHTML(
    'beforeend',
    '<div class="switch pick"><span>' +
      n[2] +
      ' <small>' +
      n[3] +
      '</small></span><span class="numrow"><input type="range" data-n="' +
      n[0] +
      '" min="' +
      n[4] +
      '" max="' +
      n[5] +
      '" step="' +
      n[6] +
      '" aria-label="' +
      n[2] +
      '"><input type="number" inputmode="numeric" data-n="' +
      n[0] +
      '" min="' +
      n[4] +
      '" max="' +
      n[5] +
      '" step="' +
      n[6] +
      '" aria-label="' +
      n[2] +
      ', as a number"><i>' +
      n[7] +
      '</i></span></div>',
  );
});
function setNum(e) {
  var k = e.target.dataset.n;
  if (!k || (e.type === 'input' && e.target.type !== 'range')) return;
  opt[k] = +e.target.value;
  saveMeta();
  applyOpts();
  renderTape(0);
  if (k === 'vib' || k === 'vol') buzz([10, 40, 10]);
} // feedback settings give a sample of the long-push tick
$('settings').addEventListener('input', setNum);
$('settings').addEventListener('change', setNum);
$('rollSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  opt.rolls = b.dataset.r;
  saveMeta();
  applyOpts();
});
$('themeSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  opt.theme = b.dataset.th;
  saveMeta();
  applyOpts();
});
$('btnFit').addEventListener('click', function () {
  show('settings', false);
  startCalib();
});
$('btnReset').addEventListener('click', function () {
  Object.keys(DEFAULTS).forEach(function (k) {
    opt[k] = DEFAULTS[k];
  });
  saveMeta();
  applyOpts();
  renderTape(0);
  toast('Every setting is back to how it came');
});
$('btnClear').addEventListener('click', function () {
  ed = { text: '', cur: 0, anchor: null };
  try {
    ask('reset', true, !!opt.cap);
  } catch (err) {}
  tape = [];
  show('settings', false);
  renderTape(0);
  renderPage();
});
window.addEventListener('resize', placeGhosts);

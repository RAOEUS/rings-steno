'use strict';
/* Starting up, and what the app calls back into. */

/* ---------- start ---------- */
function start() {
  dbGet('meta')
    .then(function (m) {
      if (!m && !IME) lesson = { menu: true }; // nothing saved yet: a first visit, so open on the lessons
      if (m && m.opt) for (var k in m.opt) opt[k] = m.opt[k];
      applyOpts();
      return new Promise(function (res) {
        natReady = res;
        natRefresh();
      }); // Plover starting and reading its dictionaries
    })
    .catch(function () {
      applyOpts();
      wire();
    })
    .then(function () {
      ready = true;
      $('loading').remove();
      renderTape(0);
      renderPage();
      try {
        ask('reset', true, !!opt.cap);
      } catch (e) {}
      setupState();
      hashPanel();
      NATIVE.ready();
      window.__rings.added();
    });
}
// what the app calls back into
window.__rings = {
  // a file was shared to the app or opened with it, and the app has already handed it to Plover
  added: function () {
    var r = NATIVE.takeAdded();
    if (!r || !ready) return;
    r = JSON.parse(r);
    openLibrary();
    if (r.error) report(r.error, true);
    else added(r.ok);
  },
  // the app screen came back to the front: the keyboard may have been switched on, the theme changed
  resume: function () {
    setupState();
    window.__rings.reload(); // a setting may have been changed from the keyboard
  },
  // settings were changed on the app screen while the keyboard's copy of the page stayed loaded: read them again
  reload: function () {
    if (ready)
      dbGet('meta').then(function (m) {
        if (m && m.opt) for (var k in m.opt) opt[k] = m.opt[k];
        applyOpts();
        natRefresh();
      });
  },
  // a new place to write, or the cursor was moved by hand. attach: no space wanted before the next word. caps: the box wants a capital here
  // secret: it is a password box
  field: function (attach, caps, hidden) {
    pvMask = -1;
    secret = !!hidden;
    renderTape(0);
    if (ready && !panel)
      try {
        ask('reset', attach, caps && !!opt.cap);
      } catch (e) {}
  },
  // for tests driving the page from outside
  send: send,
  tape: function () {
    return tape;
  },
  text: function () {
    return ed.text;
  },
};
start();

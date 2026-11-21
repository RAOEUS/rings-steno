'use strict';
/* The Dictionaries panel: the current system's stack, adding files, and Plover's plugins. */

/* ---------- library ---------- */
function stack() {
  return nat.dicts;
} // the current system's dictionaries, top first, as Plover reports them
// the system's name and size in the top bar
function wire() {
  var n = 0;
  nat.dicts.forEach(function (d) {
    if (d.enabled) n += d.size || 0;
  });
  $('sysName').textContent = nat.system === 'English Stenotype' ? 'Plover' : nat.system || 'Plover';
  $('sysCount').textContent = nat.busy
    ? 'loading'
    : stack().length
      ? (n >= 10000 ? Math.round(n / 1000) + 'k' : n.toLocaleString()) + ' entries'
      : 'set up';
  renderPage();
}
function drawLibrary() {
  document.querySelectorAll('#sysSeg button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.sys === nat.system ? 'true' : 'false');
  });
  var st = stack();
  $('dictList').innerHTML = st
    .map(function (e, i) {
      var d = e,
        meta = e.error
          ? e.error
          : e.size == null
            ? 'loading'
            : e.kind === 'py'
              ? 'Python dictionary'
              : (d.size || 0).toLocaleString() +
                ' entries' +
                (e.kind === 'modal' ? ', modal' : e.kind === 'rtf' ? ', from RTF' : '');
      return (
        '<div class="dict' +
        (e.enabled ? '' : ' off') +
        '"><span class="ord"><button data-up="' +
        i +
        '" aria-label="Move up">↑</button><button data-down="' +
        i +
        '" aria-label="Move down">↓</button></span><span class="nm">' +
        esc(e.name) +
        '</span><input type="checkbox" class="tog" data-en="' +
        i +
        '"' +
        (e.enabled ? ' checked' : '') +
        ' aria-label="Use ' +
        esc(e.name) +
        '"><span class="meta' +
        (d && d.error ? ' bad' : '') +
        '">' +
        esc(meta) +
        (d && d.pyfail
          ? ' <button data-retry="1" style="font-weight:600;text-decoration:underline;margin-left:6px">try again</button>'
          : '') +
        ' <button data-rm="' +
        i +
        '" style="color:var(--rule);font-weight:600;margin-left:8px">remove</button></span></div>'
      );
    })
    .join('');
  $('plugList').innerHTML =
    (nat.extensions || [])
      .map(function (x) {
        return (
          '<div class="dict' +
          (x.enabled ? '' : ' off') +
          '"><span class="ord"></span><span class="nm">' +
          esc(x.name) +
          '</span><input type="checkbox" class="tog" data-ext="' +
          esc(x.name) +
          '"' +
          (x.enabled ? ' checked' : '') +
          ' aria-label="Run ' +
          esc(x.name) +
          '"><span class="meta">extension: runs alongside the engine while it is switched on</span></div>'
        );
      })
      .join('') +
    (nat.plugins || [])
      .map(function (pl) {
        var gives = Object.keys(pl.provides)
          .map(function (k) {
            return k + ': ' + pl.provides[k].join(', ');
          })
          .join('; ');
        return (
          '<div class="dict"><span class="ord"></span><span class="nm">' +
          esc(pl.name) +
          ' ' +
          esc(pl.version) +
          '</span><span></span><span class="meta">' +
          esc(gives.length > 150 ? gives.slice(0, 150) + '\u2026' : gives) +
          (pl.added
            ? ' <button data-plug="' +
              esc(pl.name) +
              '" style="color:var(--rule);font-weight:600;margin-left:8px">remove</button>'
            : '') +
          '</span></div>'
        );
      })
      .join('');

  $('libEmpty').innerHTML = st.length
    ? ''
    : '<p class="lead">This system has no dictionaries in its stack. Restore its defaults, or add your own files.</p>';
  $('libNote').textContent = nat.words ? 'Spelling word list loaded for this system.' : '';
}
function openLibrary() {
  drawLibrary();
  $('libStatus').textContent = '';
  show('library', true);
}
// the stack is Plover's: hand it the new order and let it reload what changed
function setStack(list) {
  try {
    ask('set_dicts', list);
  } catch (err) {
    report(err.message, true);
  }
  natRefresh();
}
$('dictList').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  var list = nat.dicts.map(function (d) {
      return [d.path, d.enabled];
    }),
    at = +(b.dataset.up !== undefined ? b.dataset.up : b.dataset.down !== undefined ? b.dataset.down : b.dataset.rm);
  if (b.dataset.rm !== undefined) list.splice(at, 1);
  else {
    var to = b.dataset.up !== undefined ? at - 1 : at + 1;
    if (to < 0 || to >= list.length) return;
    var sw = list[at];
    list[at] = list[to];
    list[to] = sw;
  }
  setStack(list);
});
$('dictList').addEventListener('change', function (e) {
  var c = e.target;
  if (c.dataset.en === undefined) return;
  var list = nat.dicts.map(function (d) {
    return [d.path, d.enabled];
  });
  list[+c.dataset.en][1] = c.checked;
  setStack(list);
});
$('sysSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || b.dataset.sys === nat.system) return;
  try {
    ask('set_system', b.dataset.sys);
  } catch (err) {
    report(err.message, true);
  }
  natRefresh();
});
// Dictionary files from the Add files button, or dropped on the page. In the app they go to Plover as they are:
// it reads json, py, modal, rtf, and zips of them
function addFiles(fl) {
  report('Reading ' + fl.length + (fl.length === 1 ? ' file' : ' files') + '.');
  Promise.all(
    fl.map(function (f) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () {
          res([f.name, r.result.slice(r.result.indexOf(',') + 1)]);
        };
        r.onerror = function () {
          rej(new Error('could not read ' + f.name));
        };
        r.readAsDataURL(f);
      });
    }),
  )
    .then(function (files) {
      added(ask('add_files', files));
    })
    .catch(function (err) {
      report('Could not read that: ' + err.message, true);
    });
}
function added(a) {
  var plug = a.plugins || [],
    msg =
      (a.added.length ? 'Added ' + a.added.length + ': ' + a.added.join(', ') + '. ' : '') +
      (plug.length
        ? 'Plugin added: ' + plug.join(', ') + '. If it replaces one that was already running, restart Rings.'
        : '');
  report(msg || 'Nothing in there looked like a dictionary or a plugin.', !msg);
  natRefresh();
}
$('plugList').addEventListener('change', function (e) {
  var c = e.target;
  if (c.dataset.ext === undefined) return;
  try {
    ask('set_extension', c.dataset.ext, c.checked);
  } catch (err) {
    report(err.message, true);
  }
  natRefresh();
});
$('plugList').addEventListener('click', function (e) {
  var b = e.target.closest('[data-plug]');
  if (!b) return;
  try {
    ask('remove_plugin', b.dataset.plug);
    report('Removed ' + b.dataset.plug + '. Restart Rings to unload what it had already loaded.');
  } catch (err) {
    report(err.message, true);
  }
  natRefresh();
});
$('fileIn').addEventListener('change', function (e) {
  var fl = Array.from(e.target.files || []);
  e.target.value = '';
  if (fl.length) addFiles(fl);
  else report('No file was chosen.', true);
});
$('btnDefaults').addEventListener('click', function () {
  try {
    ask('set_dicts', ask('default_dicts'));
    report('Back to the defaults for ' + nat.system + '.');
  } catch (err) {
    report(err.message, true);
  }
  natRefresh();
});
// files can also be dropped anywhere on the page
window.addEventListener('dragover', function (e) {
  e.preventDefault();
  document.body.classList.add('dropping');
});
window.addEventListener('dragleave', function (e) {
  if (!e.relatedTarget) document.body.classList.remove('dropping');
});
window.addEventListener('drop', function (e) {
  e.preventDefault();
  document.body.classList.remove('dropping');
  var fl = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  if (fl.length) {
    openLibrary();
    addFiles(fl);
  }
});
$('btnAddTr').addEventListener('click', function () {
  show('library', false);
  openPrompt('add');
});
$('btnExport').addEventListener('click', function () {
  try {
    copy(ask('user_json'));
  } catch (err) {
    toast(err.message, true);
  }
});
function openLookup() {
  openPrompt('lookup');
}

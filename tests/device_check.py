"""Regression pass over the page inside the app, on a phone, through WebView debugging.

Needs a debug build installed and open on a phone connected by adb, and Python with Playwright:
    python tests/device_check.py
It makes real strokes on the app screen (not the keyboard), checks what comes out, and puts back the settings it
changes while it runs. Expected lines are for the Lapwing system with its stock dictionaries.
"""
import asyncio, json, subprocess, sys, time
from playwright.async_api import async_playwright
ADB = ['adb']      # set ANDROID_SERIAL to choose between several phones
def sh(*a): return subprocess.run(ADB + list(a), capture_output=True, text=True).stdout
HELPERS = """
window.T = (() => {
  const foot = document.getElementById('foot'), sleep = ms => new Promise(r => setTimeout(r, ms));
  const ev = (type, id, x, y) => foot.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  const num = k => +document.querySelector('input[type=number][data-n=' + k + ']').value;
  const setNum = (k, v) => { const b = document.querySelector('input[type=number][data-n=' + k + ']'); b.value = v; b.dispatchEvent(new Event('change', { bubbles: true })); };
  const scale = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), n = Math.sin(a), rv = num('far') + num('outer'); let room = Infinity; if (c > 1e-6) room = (innerWidth - x) / c; else if (c < -1e-6) room = x / -c; if (n > 1e-6) room = Math.min(room, (innerHeight - y) / n); else if (n < -1e-6) room = Math.min(room, y / -n); return Math.max(.05, Math.min(1, (room - 4) / rv)); };
  const spot = side => { const d = document.getElementById('deck').getBoundingClientRect(); return [d.left + d.width * (side === 'l' ? .3 : .7), d.top + 50]; };
  // pts: [deg, len] on a full-size, unturned stick. short/long are given as 'S' or 'L' and sized from the settings.
  const len = l => l === 'S' ? (num('dead') + num('far')) / 2 : l === 'L' ? num('far') + num('outer') * .5 : l;
  const path = (side, pts, how) => { const [x, y] = spot(side), id = side === 'l' ? 1 : 2, tilt = num(side === 'l' ? 'tiltL' : 'tiltR'); ev('pointerdown', id, x, y); let cur = [x, y]; for (const [d0, l0] of pts) { const deg = d0 + tilt, k = scale(x, y, deg), L = len(l0), to = [x + L * k * Math.cos(deg * Math.PI / 180), y + L * k * Math.sin(deg * Math.PI / 180)]; for (let i = 1; i <= 8; i++) ev('pointermove', id, cur[0] + (to[0] - cur[0]) * i / 8, cur[1] + (to[1] - cur[1]) * i / 8); cur = to; } if (how !== 'hold') ev(how || 'pointerup', id, cur[0], cur[1]); return () => ev('pointerup', id, cur[0], cur[1]); };
  const arc = (a, b, l) => { const o = []; for (let i = 0; i <= 8; i++) o.push([a + (b - a) * i / 8, l]); return o; };
  const tap = side => { const [x, y] = spot(side), id = side === 'l' ? 1 : 2; ev('pointerdown', id, x, y); ev('pointerup', id, x + 2, y); };
  const last = () => { const t = window.__rings.tape(); return t.length ? stenoOf(t[t.length - 1].mask) : null; };
  const stroke = async f => { window.__rings.tape().length = 0; f(); await sleep(num('wait') + 160); return window.__rings.tape().length ? last() : '(nothing)'; };
  const row = async list => { const got = []; for (const [want, f] of list) { const g = await stroke(f); got.push(g === want ? want : want + '≠' + g); } return got.join(' '); };
  return { path, arc, tap, last, stroke, row, sleep, num, setNum, spot };
})();
"""
async def main():
    async with async_playwright() as p:
        socks = [l.split('@')[-1].strip() for l in sh('shell', 'cat', '/proc/net/unix').splitlines() if 'webview_devtools_remote' in l]
        sh('forward', 'tcp:9333', 'localabstract:' + socks[0])
        b = await p.chromium.connect_over_cdp('http://127.0.0.1:9333')
        pages = {}
        for c in b.contexts:
            for pg in c.pages:
                if 'index.html' in pg.url: pages['ime' if await pg.evaluate("document.documentElement.classList.contains('ime')") else 'app'] = pg
        a = pages['app']; errs = []
        a.on('pageerror', lambda e: errs.append(str(e))); a.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await a.wait_for_function("!document.getElementById('loading')", timeout=90000)
        await a.evaluate(HELPERS)
        out = {'pages': sorted(pages), 'url': a.url[-28:]}
        out['settings carried over'] = await a.evaluate("['dead','far','outer','gap','tiltL','tiltR','wait','vib'].map(k => k + '=' + T.num(k)).join(' ') + ' rolls=' + document.querySelector('#rollSeg [aria-pressed=true]').dataset.r")
        keep = await a.evaluate("({ wait: T.num('wait'), arp: document.getElementById('optArp').checked, rolls: document.querySelector('#rollSeg [aria-pressed=true]').dataset.r, hands: document.querySelector('#handSeg [aria-pressed=true]').dataset.h })")
        try:
            await a.evaluate("document.querySelector('#handSeg [data-h=\"2\"]').click(); T.setNum('wait', 200); if (document.getElementById('optArp').checked) document.getElementById('optArp').click(); document.querySelector('#rollSeg [data-r=back]').click(); document.querySelectorAll('.scrim.show').forEach(s => s.classList.remove('show')); (document.querySelector('[data-lesson=menu]') || {click(){}}).click(); (document.querySelector('[data-lesson=exit]') || {click(){}}).click(); document.getElementById('btnClear').click()")
            out['system'] = await a.evaluate("document.getElementById('sysName').textContent + ' ' + document.getElementById('sysCount').textContent")
            out['L short'] = await a.evaluate("T.row([['T', 210], ['P', 270], ['H', 330], ['K', 150], ['W', 90], ['R', 30]].map(([k, d]) => [k, () => T.path('l', [[d, 'S']])]))")
            out['R short'] = await a.evaluate("T.row([['-F', 210], ['-P', 270], ['-L', 330], ['-R', 150], ['-B', 90], ['-G', 30]].map(([k, d]) => [k, () => T.path('r', [[d, 'S']])]))")
            out['L long'] = await a.evaluate("T.row([['#', 270], ['S', 180], ['*', 0], ['A', 130], ['AO', 90], ['O', 50]].map(([k, d]) => [k, () => T.path('l', [[d, 'L']])]))")
            out['R long'] = await a.evaluate("T.row([['-T', 230], ['-TD', 270], ['-D', 310], ['-S', 180], ['-Z', 0], ['E', 130], ['EU', 90], ['U', 50]].map(([k, d]) => [k, () => T.path('r', [[d, 'L']])]))")
            out['taps, gap, cancel'] = await a.evaluate("T.row([['S', () => T.tap('l')], ['*', () => T.tap('r')], ['(nothing)', () => T.path('l', [[180, 'S']])], ['(nothing)', () => T.path('l', [[150, 'S']], 'pointercancel')]])")
            out['rolls'] = await a.evaluate("T.row([['TPH', () => T.path('l', [[210, 'S'], ...T.arc(210, 330, 'S')])], ['TH', () => T.path('l', [[210, 'S'], ...T.arc(210, 330, 'S'), ...T.arc(330, 270, 'S')])], ['AO', () => T.path('l', [[130, 'L'], ...T.arc(130, 50, 'L')])], ['-TS', () => T.path('r', [[230, 'L'], ...T.arc(230, 180, 'L')])]])")
            out['KAT typed'] = await a.evaluate("(async () => { document.getElementById('btnClear').click(); const up = T.path('l', [[150, 'S']]); T.path('l', [[130, 'L']]); const held = T.path('r', [[230, 'L']], 'hold'); const pv = document.getElementById('toast').textContent; held(); await T.sleep(T.num('wait') + 200); return 'preview ' + JSON.stringify(pv) + ' | page ' + JSON.stringify(window.__rings.text()) + ' | tape ' + T.last(); })()")
            out['hint'] = await a.evaluate("(async () => { document.getElementById('btnClear').click(); for (const s of ['KR*', 'A*', 'T*']) { window.__rings.send(maskOfSteno(s)); await T.sleep(60); } return document.getElementById('toast').textContent + ' | ' + window.__rings.text(); })()")
            out['lessons'] = await a.evaluate("""(async () => { document.getElementById('btnClear').click(); document.getElementById('btnGuide').click(); document.getElementById('btnLearn').click(); const menu = document.querySelectorAll('.lesson button').length; document.querySelector('[data-lesson="0"]').click();
              const goal = document.querySelector('.goal').textContent, pic = Array.from(document.querySelectorAll('.lesson .hand')).map(h => h.querySelector('b').textContent + (h.classList.contains('idle') ? '(dim)' : '')).join('/');
              await T.stroke(() => T.path('l', [[150, 'S']])); const wrong = document.querySelector('.msg').textContent; await T.stroke(() => T.path('l', [[210, 'S']])); await T.sleep(800); const next = document.querySelector('.top span').textContent;
              document.querySelector('[data-lesson=menu]').click(); document.querySelector('[data-lesson="9"]').click(); const word = document.querySelector('.goal') ? document.querySelector('.goal').textContent : document.querySelector('.lesson h2').textContent;
              document.querySelector('[data-lesson=menu]').click(); document.querySelector('[data-lesson=calib]').click(); const fit = document.querySelector('.lesson h2').textContent; document.querySelector('[data-lesson=calib-cancel]').click(); document.querySelector('[data-lesson=exit]').click();
              return menu + ' buttons | asks ' + goal + ' | ' + pic + ' | wrong: ' + wrong + ' | then: ' + next + ' | word lesson: ' + word + ' | fit: ' + fit; })()""")
            out['one thumb'] = await a.evaluate("""(async () => { document.querySelector('#handSeg [data-h="1"]').click(); const got = [];
              got.push('push: ' + await T.stroke(() => T.path('l', [[150, 'S']])));
              got.push('tap then push: ' + await T.stroke(() => { T.tap('r'); T.path('l', [[270, 'S']]); }));
              got.push('K, tap, long up-left: ' + await T.stroke(() => { T.path('r', [[150, 'S']]); T.tap('l'); T.path('r', [[230, 'L']]); }));
              got.push('next stroke starts left: ' + await T.stroke(() => T.path('r', [[270, 'S']])));
              got.push('tap twice then push (W*): ' + await T.stroke(() => { T.tap('l'); T.tap('l'); T.path('l', [[90, 'S']]); }));
              got.push('two taps (*): ' + await T.stroke(() => { T.tap('l'); T.tap('l'); }));
              got.push('K, tap, -P, two taps (K*P): ' + await T.stroke(() => { T.path('l', [[150, 'S']]); T.tap('l'); T.path('l', [[270, 'S']]); T.tap('l'); T.tap('l'); }));
              const tint = document.getElementById('deck').classList.contains('one'); document.querySelector('#handSeg [data-h="2"]').click();
              return got.join(' | ') + ' | pad marked: ' + tint + ' | back to two: ' + !document.getElementById('deck').classList.contains('one'); })()""")
            out['look up panel'] = await a.evaluate("""(async () => { document.getElementById('btnLookup').click(); for (const ch of 'cat') Array.from(document.querySelectorAll('#qwerty [data-q]')).find(n => n.dataset.q === ch).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 8 }));
              const r = document.getElementById('pTitle').textContent + ': ' + document.getElementById('pText').lastChild.textContent + ' -> ' + document.getElementById('pInfo').textContent.slice(0, 40) + ' | keys ' + document.querySelectorAll('#qwerty [data-q]').length;
              document.querySelector('[data-do=pclose]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 8 })); return r + ' | closed ' + document.getElementById('prompt').hidden; })()""")
            out['add translation panel'] = await a.evaluate("""(async () => { document.getElementById('btnClear').click(); for (const s of ['KR*', 'A*', 'T*', 'TKUPT']) { window.__rings.send(maskOfSteno(s)); await T.sleep(80); }
              const start = document.getElementById('pTitle').textContent + ' | translation ' + JSON.stringify(document.getElementById('pText').lastChild.textContent) + ' | focus ' + document.querySelector('.pfield.on').id;
              window.__rings.send(maskOfSteno('KA*T')); await T.sleep(80); const strokes = document.getElementById('pStrokes').lastChild.textContent, info = document.getElementById('pInfo').textContent.slice(0, 50);
              document.querySelector('[data-do=pclose]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 8 })); return start + ' | strokes ' + strokes + ' | ' + info; })()""")
            out['dictionaries panel'] = await a.evaluate("""(() => { document.getElementById('btnClear').click(); document.getElementById('btnSys').click(); const r = document.querySelectorAll('#dictList .dict').length + ' dictionaries, first ' + document.querySelector('#dictList .nm').textContent + ' [' + document.querySelector('#dictList .meta').textContent.replace('remove', '').trim() + '] | ' + document.querySelectorAll('#plugList .dict').length + ' plugin rows | ' + document.querySelector('#library .fine').textContent.slice(0, 40); document.querySelector('#library [data-close]').click(); return r; })()""")
            out['settings panel'] = await a.evaluate("(() => { document.getElementById('btnSettings').click(); const r = document.querySelectorAll('#settings input[type=range]').length + ' sliders, ' + document.querySelectorAll('#settings .tog').length + ' switches, theme ' + document.documentElement.dataset.theme; document.querySelector('#settings [data-close]').click(); return r; })()")
        finally:      # whatever happened above, the writer gets their own settings back
            await a.evaluate("(k) => { T.setNum('wait', k.wait); document.querySelector('#rollSeg [data-r=' + k.rolls + ']').click(); Array.from(document.querySelectorAll('#handSeg button')).find(b => b.dataset.h === k.hands).click(); if (k.arp !== document.getElementById('optArp').checked) document.getElementById('optArp').click(); document.getElementById('btnClear').click(); }", keep)
        out['restored'] = await a.evaluate("'wait=' + T.num('wait') + ' thumbs=' + document.querySelector('#handSeg [aria-pressed=true]').dataset.h + ' rolls=' + document.querySelector('#rollSeg [aria-pressed=true]').dataset.r + ' arpeggiate=' + document.getElementById('optArp').checked")
        out['errors'] = errs
        for k, v in out.items(): print(k, '=>', v)
asyncio.run(main())

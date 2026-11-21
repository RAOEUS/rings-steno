"""Checks the headless Plover wrapper against a real Plover install. Run from a Python that has plover, plover_stroke,
plover-lapwing-aio and its plugins:   python tests/test_engine.py
Uses a throwaway config folder, never your own Plover's."""
import json, os, sys, tempfile, time

tmp = tempfile.mkdtemp()
os.environ['XDG_CONFIG_HOME'] = tmp
os.environ['XDG_DATA_HOME'] = tmp
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'python'))
if '--shim' not in sys.argv:          # default: Plover's real C stroke helper; --shim: the pure Python one the phone uses
    sys.modules.pop('_plover_stroke', None)
    import importlib.util
    for p in sys.path[1:]:
        import glob
        so = glob.glob(os.path.join(p, '_plover_stroke*.so'))
        if so:
            spec = importlib.util.spec_from_file_location('_plover_stroke', so[0]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); sys.modules['_plover_stroke'] = m
            break
import rings as R


def call(method, *args):
    r = json.loads(R.call(method, json.dumps(args)))
    assert 'ok' in r, (method, r)
    return r['ok']


def ready():
    t = time.time()
    while call('status')['busy']:
        assert time.time() - t < 60, 'dictionaries never finished loading'
        time.sleep(0.05)
    return call('status')


def keys(steno):
    """'KAT' or 'K-T' or '-T' -> Plover key names, the way the sticks send them."""
    order = '#STKPWHRAO*EUFRPBLGTSDZ'
    left, right = (steno.split('-') + [''])[:2] if '-' in steno else (None, None)
    out, i = [], 0
    if left is None:
        for c in steno:
            i = order.index(c, i); out.append(c + '-' if i < 10 and c not in '#*' else c if c in '#*' else '-' + c); i += 1
    else:
        out = [c if c in '#*' else c + '-' for c in left] + ['-' + c for c in right]
    return out


def type_(*strokes):
    text = ''
    for s in strokes:
        r = call('stroke', keys(s))
        for op in r['ops']:
            if op[0] == 'bs': text = text[:len(text) - op[1]]
            elif op[0] == 'str': text += op[1]
            else: text += '<%s:%s>' % (op[0], op[1])
    return text, r


st = ready()
print('systems:', st['systems'])
assert st['system'] == 'Lapwing' and 'English Stenotype' in st['systems'], st      # a first run opens on Lapwing
assert not any(d['error'] or d['size'] is None for d in st['dicts']) and st['dicts'][-1]['size'] > 100000, st['dicts']      # and its whole stack is loaded
call('set_system', 'English Stenotype'); st = ready()
print('plover dicts:', [(d['name'], d['size'], d['error']) for d in st['dicts']])
assert [d['name'] for d in st['dicts']] == ['user.json', 'commands.json', 'main.json'] and st['dicts'][2]['size'] > 100000

call('reset', True, False)
text, r = type_('KAT', 'S-', 'AEU', 'TKOG')
print(repr(text), r['last'])
assert text == 'cat is a dog', text
text2, r = type_('*')
assert r['ops'][0][0] == 'bs', r
pass  # number bar on the Plover layout: #S is 1, #T is 2
call('reset', True, False)
text, _ = type_('#S', '#T-')
print('numbers:', repr(text))
assert text == '12', text

# the tape's preview: what a stroke would become, asked without sending it
call('reset', True, False)
assert call('preview', keys('KAT')) == {'rtfcre': ['KAT'], 'english': 'cat'}
assert call('preview', keys('KAT')) == {'rtfcre': ['KAT'], 'english': 'cat'}      # asking twice changes nothing
assert call('preview', keys('STKPWHR')) == {'rtfcre': ['STKPWHR'], 'english': None}
text, _ = type_('KWRO')
p2 = call('preview', keys('KWRO'))
print('preview of a second KWRO:', p2)
assert p2 == {'rtfcre': ['KWRO', 'KWRO'], 'english': 'yo-yo'}, p2
pu = call('preview', keys('*')); print('preview of the star:', pu); assert (pu['english'] or '').lower() == '=undo'
text, _ = type_('KWRO')                  # and the real stroke still does what the preview said
assert text == 'yo-yo', text

# a shorter outline is offered for something written the long way
main = json.load(open(os.path.join(os.path.dirname(__import__('plover').__file__), 'assets', 'main.json')))
one = {v: k for k, v in main.items() if '/' not in k and v.isalpha() and v.islower()}
import re
two = next((k, v) for k, v in main.items() if k.count('/') == 1 and v in one and re.fullmatch(r'[STKPWHRAOEUFBLGDZ/]+', k) and '-' not in k and all(re.search('[AOEU]', part) for part in k.split('/')))
call('reset', True, False)
_, r = type_(*two[0].split('/'))
print('wrote', two[1], 'as', two[0], '-> hint:', r.get('brief'))
assert r['last']['english'] == two[1] and r['brief'] and '/' not in r['brief'], r
call('reset', True, False)
_, r = type_('KR*', 'A*', 'T*')
print('fingerspelled cat -> hint:', r.get('brief'))
assert r['brief'] == 'KAT', r
_, r = type_('KAT')
assert r['brief'] is None, r               # nothing shorter than one stroke

# lookup and add translation, the way the panels drive them
sug = call('lookup', 'cat')
print('lookup cat:', sug[0]['outlines'][:4])
assert any('KAT' in s['outlines'] for s in sug)
call('reset', True, False); type_('KAT')
start = call('prompt_open', 'add')
print('add prompt starts with:', start)
assert start['translation'] == 'cat' and start['field'] == 'strokes'
strokes, _ = type_('KWRO', 'KWRO')          # strokes field: raw steno, joined with /
print('strokes field:', repr(strokes))
assert strokes == 'KWRO/KWRO', strokes
call('prompt_focus', 'text')
tr, _ = type_('KAT', 'TKOG')
assert tr == 'cat dog', tr
print('mapping:', call('mapping', strokes, tr))
saved = call('add_translation', strokes, tr)
print('saved:', saved)
call('prompt_close')
call('reset', True, False)
text, _ = type_('KWRO', 'KWRO')
assert text == 'cat dog', text
assert json.load(open(os.path.join(tmp, 'plover', 'user.json'))) == {'KWRO/KWRO': 'cat dog'}

# Plover's own habit: fingerspell a word, stroke TKUPT, and the panel opens with that word as the translation and the
# cursor waiting in the strokes field
call('reset', True, False)
text, r = type_('KR*', 'A*', 'T*', 'TKUPT')
assert text == 'cat<cmd:add_translation>', (text, r)
start = call('prompt_open', 'add')
print('after fingerspelling c-a-t then TKUPT:', start)
assert start == {'strokes': '', 'translation': 'cat', 'field': 'strokes'}, start
strokes, _ = type_('KA*T')
assert strokes == 'KA*T', strokes
_, r = type_('R*R')                      # Return, stroked in the strokes field, still gets through to save
assert r['ops'] == [['combo', 'Return']], r
print('saved:', call('add_translation', strokes, start['translation']))
call('prompt_close')
text, _ = type_('KA*T')                  # back in the document, straight after the fingerspelled word
print('document after saving and writing the new outline:', repr('cat' + text))
assert text == ' cat', text

# engine commands arrive as commands, not text
call('reset', True, False)
_, r = type_('TKUPT')          # {PLOVER:ADD_TRANSLATION}
assert ['cmd', 'add_translation'] in r['ops'], r
_, r = type_('R*R')            # {#Return}{^}
print('R*R ops:', r['ops'])
assert r['ops'] == [['combo', 'Return']], r
print('key events for Control_L(Shift_L(Left)) a:', call('key_events', 'Control_L(Shift_L(Left)) a'))

# switch system: Plover swaps in that system's own dictionary stack
call('set_system', 'Lapwing')
st = ready()
print('lapwing dicts:', [(d['name'], d['size'], d['error']) for d in st['dicts']])
assert st['system'] == 'Lapwing' and not any(d['error'] for d in st['dicts']), st
call('reset', True, False)
text, r = type_('KAT', 'S', 'A', 'TKOG')
print('lapwing:', repr(text), r['last'])
_, r = type_('PHRUP')          # {PLOVER:LOOKUP} in lapwing-commands.json
assert ['cmd', 'lookup'] in r['ops'], r
text, r = type_('#')           # Lapwing: the number key is a key of its own
print('lapwing after #:', repr(text), r['steno'])

# stack edits: switch one off, reorder, and it survives a restart of the config
d = st['dicts']
call('set_dicts', [[x['path'], x['name'] != 'lapwing-base.json'] for x in d])
st = ready()
call('reset', True, False)
text, _ = type_('KAT')
print('base off:', repr(text))
assert text == 'KAT', text
call('set_dicts', [[x['path'], True] for x in d])
ready()
call('set_system', 'English Stenotype')
st = ready()
assert [d['name'] for d in st['dicts']] == ['user.json', 'commands.json', 'main.json'], st['dicts']
import base64
print('add file:', call('add_files', [['mine.json', base64.b64encode(b'{"KAT": "feline"}').decode()], ['notes.txt', 'eA==']]))
st = ready()
call('reset', True, False)
text, _ = type_('KAT')
assert text == 'feline' and st['dicts'][0]['name'] == 'mine.json', (text, st['dicts'][0])
call('set_system', 'Lapwing'); ready()
print('lapwing preview of KAT:', call('preview', keys('KAT')), '| modal dictionaries still on:', all(d['enabled'] for d in call('status')['dicts'] if d['kind'] == 'modal'))
defaults = call('default_dicts')
print('lapwing defaults:', [os.path.basename(p) for p, _ in defaults][:4], '...')
assert [p for p, _ in defaults] == [d['path'] for d in call('status')['dicts']], defaults
assert 'KWRO/KWRO' in call('user_json')
# extensions: Lapwing's modal movement dictionary needs modal_update running, so it is on from the first start
st = call('status')
print('extensions:', st['extensions'])
assert {'name': 'modal_update', 'enabled': True} in st['extensions'], st['extensions']
assert 'modal_update' in R.core.engine._running_extensions
print('plugins:', [(p['name'], p['version'], sorted(p['provides'])) for p in st['plugins']])
assert {p['name'] for p in st['plugins']} >= {'plover', 'plover-lapwing-aio', 'plover-last-translation', 'plover-stitching', 'plover-modal-dictionary', 'plover-python-dictionary', 'plover-dict-commands'}
call('set_extension', 'modal_update', False); ready(); assert 'modal_update' not in R.core.engine._running_extensions
call('set_extension', 'modal_update', True); ready(); assert 'modal_update' in R.core.engine._running_extensions

# a plugin added as a wheel file: here a made-up one that brings a macro
import io, zipfile
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w') as z:
    z.writestr('rings_test_plugin.py', "from plover.translation import Translation\ndef shout(translator, stroke, cmdline):\n    translator.translate_translation(Translation([stroke], 'SHOUT ' + cmdline))\n")
    z.writestr('rings_test_plugin-0.1.dist-info/METADATA', 'Metadata-Version: 2.1\nName: rings-test-plugin\nVersion: 0.1\n')
    z.writestr('rings_test_plugin-0.1.dist-info/entry_points.txt', '[plover.macro]\nshout = rings_test_plugin:shout\n')
    z.writestr('rings_test_plugin-0.1.dist-info/RECORD', 'rings_test_plugin.py,,\nrings_test_plugin-0.1.dist-info/METADATA,,\nrings_test_plugin-0.1.dist-info/entry_points.txt,,\nrings_test_plugin-0.1.dist-info/RECORD,,\n')
r = call('add_files', [['rings_test_plugin-0.1-py3-none-any.whl', base64.b64encode(buf.getvalue()).decode()], ['shout.json', base64.b64encode(b'{"STPH": "=shout:hello"}').decode()]])
print('add a wheel and a dictionary that uses it:', r)
st = ready()
assert r['plugins'] == ['rings-test-plugin'] and any(p['name'] == 'rings-test-plugin' and p['added'] for p in st['plugins']), st['plugins']
call('reset', True, False)
text, _ = type_('STPH')
print('the added macro, stroked:', repr(text))
assert text == 'SHOUT hello', text
try:
    R.plugins.install_wheel('plover-9.9-py3-none-any.whl', (lambda b: (zipfile.ZipFile(b, 'w').__enter__().writestr('plover-9.9.dist-info/METADATA', 'Name: plover\n'), b)[1])(io.BytesIO()).getvalue())
except Exception as e: print('replacing the engine is refused:', e)
call('remove_plugin', 'rings-test-plugin'); st = ready()
assert not any(p['name'] == 'rings-test-plugin' for p in st['plugins']), st['plugins']
call('set_dicts', [[d['path'], d['enabled']] for d in st['dicts'] if d['name'] != 'shout.json']); ready()
third = sorted({m.split('.')[0] for m, mod in sys.modules.items() if 'site-packages' in (getattr(mod, '__file__', '') or '')})
print('third-party modules the engine imported:', third)
print('ALL OK')

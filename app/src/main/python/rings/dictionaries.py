"""The system in use and its dictionary stack, as Plover's config holds them, and looking things up in them.
"""
import base64
import io
import os
import zipfile

from . import core, plugins, status

DICT_EXT = ('.json', '.py', '.modal', '.rtf')
MAX_UNPACKED = 256 << 20      # a zip that would unpack to more than this is refused rather than left to fill the phone


def set_system(name):
    core.set_config(system_name=name)


def set_dicts(dicts):
    """The whole stack for the current system, top first: [[path, enabled], ...]. Order, switches and removals."""
    from plover.config import DictionaryConfig
    core.set_config(dictionaries=[DictionaryConfig(p, bool(e)) for p, e in dicts])


def add_files(files):
    """files: [[name, base64], ...]. Dictionary files go into Plover's config folder and on top of the stack. A zip is
    unpacked and every dictionary inside it added. A wheel that carries Plover plugins is installed as a plugin."""
    from plover.config import DictionaryConfig
    from plover.oslayer.config import CONFIG_DIR
    added, skipped, new_plugins = [], [], []

    def put(name, data):
        name = os.path.basename(name)
        if not name.lower().endswith(DICT_EXT):
            skipped.append(name)
            return
        with open(os.path.join(CONFIG_DIR, name), 'wb') as fp:
            fp.write(data)
        added.append(name)
    for name, b64 in files:
        data = base64.b64decode(b64)
        if name.lower().endswith('.whl'):
            plugin = plugins.install_wheel(name, data)
            if plugin is not None:
                new_plugins.append(plugin)
                continue
        if name.lower().endswith(('.zip', '.whl')):
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if sum(info.file_size for info in z.infolist()) > MAX_UNPACKED:
                    raise ValueError('%s unpacks to more than this app will take' % name)
                for info in z.infolist():
                    if not info.is_dir():
                        put(info.filename, z.read(info))
        else:
            put(name, data)
    if new_plugins:
        plugins.register()
    if added or new_plugins:
        paths = [os.path.join(CONFIG_DIR, n) for n in dict.fromkeys(added)]
        old = [d for d in core.engine.config['dictionaries'] if d.path not in paths]
        core.changing()
        core.engine._same_thread_hook(lambda: [core.engine._dictionaries_manager.unload_outdated(), None][1])   # a file added again under the same name is read again
        if paths:
            core.engine.config = {'dictionaries': [DictionaryConfig(p) for p in paths] + old}
        core.engine._same_thread_hook(core.changed)
    return {'added': added, 'skipped': skipped, 'plugins': new_plugins}


def default_dicts():
    """The current system's own stack, as a fresh Plover install has it: [[path, enabled], ...]."""
    from plover import system
    from plover.config import DictionaryConfig
    return [[DictionaryConfig(d).path, True] for d in system.DEFAULT_DICTIONARIES]


def user_json():
    """The text of the dictionary new translations are saved into, to copy out of the app."""
    target = core.sync(lambda: next((d for d in core.engine.dictionaries.dicts if d.enabled and not d.readonly), None))
    if target is None:
        raise ValueError('no dictionary that can be written to is switched on')
    with open(target.path, encoding='utf-8') as fp:
        return fp.read()


def lookup(text):
    """Plover's own suggestions for a translation: the same list its Lookup window shows."""
    from plover.translation import unescape_translation
    text = unescape_translation(text.strip())
    if not text:
        return []
    return core.sync(lambda: [{'text': s.text, 'outlines': ['/'.join(o) for o in s.steno_list]} for s in core.engine.get_suggestions(text)])


def mapping(strokes, translation):
    """For the add-translation panel: what these strokes already mean, and how this translation is already written."""
    from plover.steno import normalize_steno
    from plover.translation import unescape_translation

    def run():
        out = {'valid': False, 'strokes': None, 'means': None, 'written': []}
        raw = '/'.join(strokes.replace('/', ' ').split())
        if raw:
            try:
                key = normalize_steno(raw)
                out.update(valid=True, strokes='/'.join(key), means=core.engine.raw_lookup(key))
            except ValueError:
                pass
        text = unescape_translation(translation.strip())
        if text:
            out['written'] = sorted('/'.join(o) for o in core.engine.reverse_lookup(text))[:8]
        return out
    return core.sync(run)


def add_translation(strokes, translation):
    """Save a new entry into the first writable dictionary that is switched on, as Plover's window does."""
    from plover.steno import normalize_steno
    from plover.translation import unescape_translation

    def run():
        key = normalize_steno('/'.join(strokes.replace('/', ' ').split()))
        text = unescape_translation(translation.strip())
        if not key or not text:
            raise ValueError('strokes and a translation are both needed')
        target = next((d for d in core.engine.dictionaries.dicts if d.enabled and not d.readonly), None)
        if target is None:
            raise ValueError('no dictionary that can be written to is switched on')
        core.engine.add_translation(key, text, dictionary_path=target.path)
        status.snapshot()
        return {'strokes': '/'.join(key), 'translation': text, 'dictionary': os.path.basename(target.path)}
    return core.sync(run)

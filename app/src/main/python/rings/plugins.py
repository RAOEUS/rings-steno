"""Plover's plugins: the ones built into the app, and pure Python ones added on the phone from a wheel file.
"""
import io
import os
import zipfile

from . import core

# The kinds of Plover plugin an engine can use here. Machines and windows are left out: there is no hardware to open
# and no desktop to draw on.
KINDS = ('command', 'dictionary', 'extension', 'macro', 'meta', 'system')
PROTECTED = ('plover', 'plover-stroke', 'rtf-tokenize', 'appdirs', 'pyserial')      # what the engine itself stands on


def folder():
    from plover.oslayer.config import CONFIG_DIR
    return os.path.join(CONFIG_DIR, 'plugins')


def register():
    """Fill Plover's registry from every installed plugin, the ones built into the app and the ones added since.
    Plover's own registry.update() would also try to load the desktop machines and windows."""
    import importlib
    from importlib.metadata import entry_points
    from plover.registry import registry
    importlib.invalidate_caches()
    for kind in KINDS:
        for entrypoint in entry_points(group='plover.' + kind):
            registry.register_plugin_from_entrypoint(kind, entrypoint)


def installed():
    """Every installed distribution that brings Plover plugins: what it is and what it provides."""
    from importlib.metadata import distributions
    # which ones were added on the phone: asked of that folder alone, because the ones built into the app live inside
    # its package and cannot say where their files are
    added = {(d.metadata['Name'] or '').lower() for d in distributions(path=[folder()])}
    out, seen = [], set()
    for d in distributions():
        name = d.metadata['Name']
        provides = {}
        for ep in d.entry_points:
            if ep.group.startswith('plover.') and ep.group[7:] in KINDS:
                provides.setdefault(ep.group[7:], []).append(ep.name)
        if not name or not provides or name.lower() in seen:
            continue
        seen.add(name.lower())
        out.append({'name': name, 'version': d.version, 'provides': provides, 'added': name.lower() in added})
    return sorted(out, key=lambda p: (p['name'].lower() != 'plover', p['name'].lower()))


def _find_added(name):
    from importlib.metadata import distributions
    want = name.lower().replace('_', '-')
    return [d for d in distributions(path=[folder()]) if (d.metadata['Name'] or '').lower().replace('_', '-') == want]


def _remove_added(name):
    """Take a plugin that was added on the phone back out. Its code stays loaded until the app restarts."""
    gone = False
    for d in _find_added(name):
        root = folder()
        for f in d.files or []:
            path = os.path.join(root, str(f))
            if os.path.isfile(path):
                os.remove(path)
        for sub in sorted({os.path.dirname(os.path.join(root, str(f))) for f in d.files or []}, key=len, reverse=True):
            if os.path.isdir(sub) and os.path.realpath(sub) != os.path.realpath(root) and not os.listdir(sub):
                os.rmdir(sub)
        gone = True
    return gone


def install_wheel(filename, data):
    """A Plover plugin as a wheel file. Pure Python only: the phone cannot run code compiled for another machine."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        meta = next((n for n in names if n.count('/') == 1 and n.endswith('.dist-info/METADATA')), None)
        if meta is None:
            return None
        entry = meta[:-len('METADATA')] + 'entry_points.txt'
        if entry not in names or 'plover.' not in z.read(entry).decode('utf-8', 'replace'):
            return None
        name = next((l.split(':', 1)[1].strip() for l in z.read(meta).decode('utf-8', 'replace').splitlines() if l.lower().startswith('name:')), filename)
        if name.lower().replace('_', '-') in PROTECTED:
            raise ValueError('%s is part of the engine and cannot be replaced from here' % name)
        if any(n.lower().endswith(('.so', '.pyd', '.dylib', '.dll')) for n in names):
            raise ValueError('%s contains compiled code built for another kind of device. Only pure Python plugins can be added.' % name)
        if any(n.startswith(('/', '\\')) or '..' in n.replace('\\', '/').split('/') for n in names):
            raise ValueError('%s is not a well-formed wheel' % filename)
        _remove_added(name)
        z.extractall(folder())
    return name


def set_extension(name, on):
    """Switch one of Plover's extension plugins on or off, as its Configure window does."""
    now = set(core.engine.config['enabled_extensions'])
    core.set_config(enabled_extensions=(now | {name}) if on else (now - {name}))


def remove_plugin(name):
    """Take out a plugin that was added on the phone. What it had loaded stays until the app is restarted."""
    if not _remove_added(name):
        raise ValueError('%s is built into the app and cannot be removed' % name)
    core.changing()
    core.engine._same_thread_hook(core.changed)

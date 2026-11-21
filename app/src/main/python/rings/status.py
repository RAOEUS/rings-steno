"""What the page shows about the engine: the system, its dictionary stack, plugins and extensions. Built on the
engine thread after each change and kept, so that asking for it never waits on a dictionary that is still loading.
"""
import os

from . import core, plugins

_cache = {'system': '', 'systems': [], 'dicts': [], 'output': True, 'words': False, 'extensions': [], 'plugins': []}


def snapshot():
    from plover import system
    from plover.engine import ErroredDictionary
    from plover.oslayer.config import CONFIG_DIR
    from plover.registry import registry
    from plover.resource import ASSET_SCHEME
    cfg = core.engine.config
    loaded = {d.path: d for d in core.engine.dictionaries.dicts}
    dicts = []
    for dc in cfg['dictionaries']:
        d = loaded.get(dc.path)
        bad = isinstance(d, ErroredDictionary)
        dicts.append({
            'path': dc.path, 'name': os.path.basename(dc.path), 'enabled': dc.enabled,
            'size': None if d is None or bad else len(d),
            'error': str(d.exception) if bad else None,
            'readonly': bool(d is None or d.readonly),
            'builtin': dc.path.startswith(ASSET_SCHEME) or not os.path.realpath(dc.path).startswith(os.path.realpath(CONFIG_DIR)),
            'kind': os.path.splitext(dc.path)[1][1:].lower(),
        })
    _cache.update(system=system.NAME, systems=sorted(p.name for p in registry.list_plugins('system')),
                  dicts=dicts, output=core.engine.output, words=bool(system.ORTHOGRAPHY_WORDS),
                  extensions=[{'name': p.name, 'enabled': p.name in cfg['enabled_extensions']} for p in sorted(registry.list_plugins('extension'), key=lambda p: p.name)],
                  plugins=plugins.installed())


def status():
    core.start()
    return dict(_cache, busy=core.busy())

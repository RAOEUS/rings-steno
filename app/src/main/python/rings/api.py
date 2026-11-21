"""The app's one way in: call(method, json_args) answers with JSON."""
import json
import threading

from . import core, dictionaries, panels, plugins, status, strokes

_lock = threading.Lock()      # one caller at a time: the app has two pages (the keyboard and the app screen) on one engine

METHODS = {f.__name__: f for f in (
    status.status,
    strokes.stroke, strokes.preview, strokes.reset, strokes.key_events,
    dictionaries.set_system, dictionaries.set_dicts, dictionaries.add_files, dictionaries.default_dicts, dictionaries.user_json,
    dictionaries.lookup, dictionaries.mapping, dictionaries.add_translation,
    plugins.set_extension, plugins.remove_plugin,
    panels.prompt_open, panels.prompt_focus, panels.prompt_typed, panels.prompt_close,
)}


def call(method, args='[]'):
    """Always answers with JSON: {"ok": value} or {"error": message}."""
    try:
        with _lock:
            core.start()
            return json.dumps({'ok': METHODS[method](*json.loads(args))})
    except Exception as e:
        return json.dumps({'error': '%s: %s' % (type(e).__name__, e)})

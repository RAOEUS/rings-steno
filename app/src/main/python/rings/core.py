"""The engine's life. Starts Plover's own StenoEngine with Plover's own config file, registry, systems, dictionaries
and plugins, and gives the other modules a way to reach it. Nothing in this package translates steno.
"""
import os
import sys
import threading

from . import plugins, status

engine = None                     # Plover's StenoEngine, once start() has run
_pending = 0                      # config changes the engine thread has not finished: dictionaries are still loading


class _Out:
    """Stands in for Plover's keyboard emulation: keeps what Plover would have typed, in order."""
    def __init__(self):
        self.ops = []

    def send_backspaces(self, n): self.ops.append(['bs', n])
    def send_string(self, s): self.ops.append(['str', s])
    def send_key_combination(self, c): self.ops.append(['combo', c])
    def set_key_press_delay(self, d): pass

    def take(self):
        ops, self.ops = self.ops, []
        return ops


class _Controller:
    """Plover's single-instance socket. There is only ever one of us."""
    def start(self, on_message): pass
    def stop(self): pass


out = _Out()


def busy():
    """Is the engine still loading dictionaries? Strokes are not taken while it is."""
    return _pending > 0


def start():
    global engine
    if engine is not None:
        return
    from plover import log
    from plover.config import Config
    from plover.engine import StenoEngine
    from plover.machine.base import StenotypeBase
    from plover.oslayer.config import CONFIG_DIR, CONFIG_FILE
    from plover.registry import registry

    os.makedirs(CONFIG_DIR, exist_ok=True)
    first_run = not os.path.exists(CONFIG_FILE)
    if first_run:
        open(CONFIG_FILE, 'w').close()
    # Every system keeps user.json at the top of its stack, but only Plover's own system ships one to copy. A desktop
    # Plover always has it by the time another system is chosen; here the first system is Lapwing, so put it there.
    user = os.path.join(CONFIG_DIR, 'user.json')
    if not os.path.exists(user):
        import shutil
        from plover.resource import resource_filename
        shutil.copyfile(resource_filename('asset:plover:assets/user.json'), user)
    log.setup_logfile()
    # plugins added on the phone live beside the config, ahead of the built-in ones so a newer copy wins
    os.makedirs(plugins.folder(), exist_ok=True)
    if plugins.folder() not in sys.path:
        sys.path.insert(0, plugins.folder())
    plugins.register()
    from plover.machine.gemini_pr import GeminiPr

    class Rings(StenotypeBase):
        """The on-screen sticks. Strokes arrive through the engine's own machine callback, already as steno keys, so
        the keymap is never consulted; it borrows Gemini PR's so every system has a valid one for it."""
        KEYS_LAYOUT = GeminiPr.KEYS_LAYOUT
        KEYMAP_MACHINE_TYPE = 'Gemini PR'

        def __init__(self, params):
            super().__init__()

        def start_capture(self): self._ready()
        def stop_capture(self): self._stopped()

        @classmethod
        def get_option_info(cls): return {}

    registry.register_plugin('machine', 'Gemini PR', GeminiPr)      # only so its keymap can be borrowed
    registry.register_plugin('machine', 'Rings', Rings)

    class Engine(StenoEngine, threading.Thread):
        def __init__(self, config, controller, keyboard_emulation):
            StenoEngine.__init__(self, config, controller, keyboard_emulation)
            threading.Thread.__init__(self, name='plover-engine', daemon=True)

        def _in_engine_thread(self): return threading.current_thread() is self

        def start(self):
            threading.Thread.start(self)
            StenoEngine.start(self)

    config = Config(CONFIG_FILE)
    try:
        config.load()
    except Exception:
        log.error('loading the configuration failed, starting from defaults', exc_info=True)
        config.clear()
    config.update(machine_type='Rings', auto_start=True)
    # Lapwing's movement dictionary only works with the modal dictionary plugin's extension running, which desktop
    # Plover leaves for you to tick in its settings. Switch it on once; after that the choice is yours.
    marker = os.path.join(CONFIG_DIR, 'rings-extensions-set')
    if not os.path.exists(marker):
        if any(p.name == 'modal_update' for p in registry.list_plugins('extension')):
            config.update(enabled_extensions=set(config['enabled_extensions']) | {'modal_update'})
            config.save()
        open(marker, 'w').close()
    if first_run:
        config.update(system_name='Lapwing')      # the page has always opened on Lapwing; Plover's own default is English Stenotype
        config.save()
    engine = Engine(config, _Controller(), out)
    for name in ('lookup', 'add_translation', 'configure', 'focus', 'suggestions'):
        engine.hook_connect(name, lambda name=name: out.ops.append(['cmd', name]))
    changing()
    engine.start()
    engine._same_thread_hook(changed)


def changing():
    global _pending
    _pending += 1


def changed():
    """Runs on the engine thread after a config change has been applied and its dictionaries loaded."""
    global _pending
    try:
        status.snapshot()
    finally:
        _pending -= 1      # whatever went wrong with the report, the engine itself is ready: never leave the app waiting


def set_config(**update):
    changing()
    engine.config = update
    engine._same_thread_hook(changed)


def sync(fn):
    """Run fn on the engine thread, after anything already queued, and hand back what it returns."""
    done, box = threading.Event(), {}

    def run():
        try:
            box['v'] = fn()
        except Exception as e:  # report it to the page; the engine thread carries on
            box['e'] = '%s: %s' % (type(e).__name__, e)
        finally:
            done.set()
    engine._same_thread_hook(run)
    if not done.wait(20):
        raise TimeoutError('the engine did not answer')
    if 'e' in box:
        raise RuntimeError(box['e'])
    return box.get('v')

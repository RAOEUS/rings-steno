"""The Look up and Add translation panels. Plover's own windows give each text field its own translator state while
it has the focus and put the old one back afterwards. This is that, with the fields living in the page.
"""
from . import core

_prompt = None      # the open panel: its engine states


def is_open():
    return _prompt is not None


def _strokes_filter(key, value):
    # as in Plover's add-translation window: in the strokes field only undo and key or command entries still translate,
    # so everything else comes out as raw steno
    if value == '=undo':
        return False
    escaped = value.replace('\\\\', '').replace('\\{', '')
    return not ('{#' in escaped or '{PLOVER:' in escaped)


def _use(state):
    old = _prompt.get('now')
    if old is not None and old[0] is not None:
        core.engine.remove_dictionary_filter(old[0])
    core.engine.translator_state, core.engine.starting_stroke_state = state[1], state[2]
    if state[0] is not None:
        core.engine.add_dictionary_filter(state[0])
    _prompt['now'] = state


def prompt_open(kind):
    """kind: 'lookup' or 'add'. Returns what Plover's add-translation window starts with: the last untranslated
    strokes, or else the last word written."""
    from plover.engine import StartingStrokeState
    from plover.formatting import RetroFormatter, SPACE_PLACEMENT_BEFORE

    def run():
        global _prompt
        if _prompt is not None:
            _close()
        start = {'strokes': '', 'translation': ''}
        last = core.engine.translator_state.translations
        t = next((t for t in reversed(last) if t.has_undo()), None)
        if kind == 'add':
            if t is not None and not t.english:
                start['strokes'] = '/'.join(t.rtfcre)
            else:
                words = RetroFormatter(last).last_words(strip=True)
                if words:
                    start['translation'] = words[0]
        original = (None, core.engine.translator_state, core.engine.starting_stroke_state)
        core.engine.clear_translator_state()
        strokes = (_strokes_filter, core.engine.translator_state, StartingStrokeState(True, False, '/', SPACE_PLACEMENT_BEFORE))
        core.engine.clear_translator_state()
        text = (None, core.engine.translator_state, StartingStrokeState(True, False, ' '))
        _prompt = {'original': original, 'strokes': strokes, 'text': text, 'now': original}
        _use(strokes if kind == 'add' and not start['strokes'] else text)
        start['field'] = 'strokes' if _prompt['now'] is strokes else 'text'
        return start
    return core.sync(run)


def prompt_focus(field):
    """field: 'strokes' or 'text'."""
    core.sync(lambda: _prompt is not None and _use(_prompt[field]))


def prompt_typed():
    """Letters were typed into the focused field with the panel's own letter keys, which Plover never saw: start that
    field's translator afresh so a later undo cannot take out typed letters. The next stroke attaches, no space."""
    def run():
        if _prompt is None:
            return
        field = 'strokes' if _prompt['now'] is _prompt['strokes'] else 'text'
        core.engine.clear_translator_state()
        _prompt[field] = _prompt['now'] = (_prompt['now'][0], core.engine.translator_state, _prompt['now'][2])
        core.engine.starting_stroke_state = _prompt['now'][2]
    core.sync(run)


def _close():
    global _prompt
    if _prompt is not None:
        _use(_prompt['original'])
        _prompt = None


def prompt_close():
    core.sync(_close)

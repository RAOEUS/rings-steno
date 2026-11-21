"""Strokes from the sticks: sending one to Plover, previewing one that is still being built, and hints.
"""
from . import core, panels


def _brief(translations):
    """A shorter way to write the word that was just finished, if the dictionaries have one: fewer strokes than were
    spent on it. Looks at a multi-stroke entry, a word finished with an ending, and a word fingerspelled whole."""
    from plover.formatting import RetroFormatter
    if not translations:
        return None
    last = translations[-1]
    english = last.english or ''
    if not english or english.startswith('='):
        return None
    used, text = len(last.rtfcre), english
    if '{' in english:
        words = RetroFormatter(translations).last_words(1, strip=True)
        if not words:
            return None
        text = words[0]
        if '{&' in english:                       # fingerspelling: a stroke for each letter of the word so far
            used = 0
            for t in reversed(translations):
                if not (t.english and '{&' in t.english):
                    break
                used += len(t.rtfcre)
            if used != len(text):
                return None
        elif '{^' in english and len(translations) > 1:      # an ending: its strokes and the stem's
            used += len(translations[-2].rtfcre)
        else:
            return None
    if used < 2:
        return None
    best = None
    for s in core.engine.get_suggestions(text):
        if s.text == text:
            for outline in s.steno_list:
                if len(outline) < used and (best is None or len(outline) < len(best)):
                    best = outline
    return '/'.join(best) if best else None


def stroke(keys):
    """One stroke from the sticks, as Plover key names. Returns what Plover typed and what it made of the stroke."""
    if core.busy():
        return {'busy': True, 'ops': []}
    from plover.steno import Stroke
    core.engine._machine_stroke_callback(keys)        # the same door every Plover machine uses

    def collect():
        steno = Stroke(keys).rtfcre
        tr = core.engine.translator_state.translations
        last = tr[-1] if tr else None
        try:
            brief = _brief(tr) if core.engine.output and not panels.is_open() else None
        except Exception:
            brief = None      # a hint is never worth losing a stroke over
        return {'steno': steno, 'ops': core.out.take(), 'output': core.engine.output, 'brief': brief,
                'last': None if last is None else {'rtfcre': list(last.rtfcre), 'english': last.english}}
    return core.sync(collect)


def preview(keys):
    """What Plover would make of this stroke if it were sent now, without sending it: the tape shows it while the
    stroke is still being built. The choice is made exactly as Translator.translate_stroke makes it, read-only.
    Modal dictionaries are left out: they keep count of the strokes they are asked about, and a stroke that is only
    being considered must not be counted."""
    if core.busy():
        return None
    from plover import system
    from plover.steno import Stroke
    from plover.translation import Translation, _mapping_to_macro

    def run():
        if not core.engine.output:
            return None
        tr, stroke = core.engine._translator, Stroke(keys)
        modal = [d for d in core.engine.dictionaries.dicts if d.enabled and 'modal' in type(d).__module__]
        for d in modal:
            d.enabled = False
        try:
            max_len = tr._dictionary.longest_key
            mapping = tr._lookup_with_prefix(max_len, tr._state.translations, [stroke])
            macro = _mapping_to_macro(mapping, stroke)
            if macro is not None:      # undo and the like: the star needs no dictionary entry to be one
                return {'rtfcre': [stroke.rtfcre], 'english': '=' + macro.name}
            t = (tr._find_longest_match(2, max_len, stroke)
                 or (mapping is not None and Translation([stroke], mapping))
                 or tr._find_longest_match(1, max_len, stroke, system.SUFFIX_KEYS)
                 or Translation([stroke], None))
            return {'rtfcre': list(t.rtfcre), 'english': t.english}
        finally:
            for d in modal:
                d.enabled = True
    return core.sync(run)


def reset(attach=True, capitalize=False):
    """A new place to type: forget the strokes so far. attach: no space before the first word."""
    from plover.engine import StartingStrokeState

    def run():
        core.engine.clear_translator_state()
        core.engine.starting_stroke_state = StartingStrokeState(attach, capitalize)
    if not core.busy():
        core.sync(run)


def key_events(combo):
    """A Plover key combination, parsed by Plover: [[key name, pressed], ...]."""
    from plover.key_combo import parse_key_combo
    return [[name, pressed] for name, pressed in parse_key_combo(combo)]

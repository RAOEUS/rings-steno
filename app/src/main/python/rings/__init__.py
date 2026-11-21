"""Plover itself, run headless, as the steno engine behind the Rings keyboard.

The app calls rings.call(method, json_args) and gets JSON back. See api.py for what it can ask.
"""
from .api import call  # noqa: F401

# Third-party notices

Rings' own code is under the MIT License (see [LICENSE](LICENSE)). It is built on the open source work listed here.
Each component stays under its own license, and nothing in this file changes that.

## What this means for the app

Plover and most of its plugins are under the GNU General Public License. They are installed into the APK when it is
built, and Rings runs them in its own process. A built APK is therefore a combined work that is distributed under
the terms of the GPL: version 2 or later for Plover itself, and version 3 or later once the two GPL-3.0 plugins below
are included. This repository is the corresponding source, together with the upstream projects linked here.

If you only reuse Rings' own source files, the MIT License applies to them.

## The engine

| Component | Version | Author | License |
| --- | --- | --- | --- |
| [Plover](https://github.com/openstenoproject/plover) | 5.4.2 | Open Steno Project (Joshua Harlan Lifton, Hesky Fisher and contributors) | GPL-2.0-or-later |
| [plover_stroke](https://github.com/benoit-pierre/plover_stroke) | 1.1.0 | Benoit Pierre | GPL-2.0-or-later |
| [rtf_tokenize](https://github.com/benoit-pierre/rtf_tokenize) | 1.0.1 | Benoit Pierre | GPL-2.0-or-later |

`plover_stroke` and `rtf_tokenize` contain C code. The files in `wheels/` are builds of their unmodified source
releases for arm64 Android, produced by `native/build_wheels.py`.

## Systems, dictionaries and plugins

| Component | Version | Author | License |
| --- | --- | --- | --- |
| [plover-lapwing-aio](https://github.com/aerickt/plover-lapwing-aio) | 1.5.0 | Aerick | GPL-2.0-or-later |
| [plover-python-dictionary](https://github.com/benoit-pierre/plover_python_dictionary) | 1.2.1 | Benoit Pierre | GPL-2.0-or-later |
| [plover-modal-dictionary](https://github.com/Kaoffie/plover_modal_dictionary) | 0.0.3 | Kaoffie | MIT |
| [plover-stitching](https://github.com/morinted/plover_stitching) | 0.1.0 | Ted Morin | GPL-3.0-or-later |
| [plover-last-translation](https://github.com/nsmarkop/plover_last_translation) | 0.0.2 | Nick Markopoulos | GPL-3.0-or-later |
| [plover-dict-commands](https://github.com/KoiOates/plover_dict_commands) | 0.2.5 | Ian Cloud | GPL-2.0-or-later |

The Lapwing package carries the Lapwing theory dictionaries by Aerick, and dictionaries by other authors that it
credits in its own documentation: jeff-phrasing by Jeff Wu, emily-symbols and emily-modifiers by EPLHREU, and
abby-left-hand-modifiers by Abkwreu. Plover carries its own main, commands and user dictionaries.

## In Rings' source

| Component | Where | Author | License |
| --- | --- | --- | --- |
| [plover_controller](https://github.com/tadeokondrak/plover_controller) default stick mapping | `app/src/main/assets/ui/js/rollmap.js` | Tadeo Kondrak and contributors | GPL-2.0-or-later |

That one file is a table copied from plover_controller. It is used by the "Backward skips" roll setting and is not
covered by the MIT License. The six-way arrangement of the block follows the same project.

## Runtime and libraries

| Component | Version | Author | License |
| --- | --- | --- | --- |
| [Chaquopy](https://chaquo.com/chaquopy/) | 17.0.0 | Chaquo Ltd | MIT |
| [CPython](https://www.python.org/) | 3.11 | Python Software Foundation | PSF-2.0 |
| [appdirs](https://github.com/ActiveState/appdirs) | 1.4.4 | Trent Mick | MIT |
| [pyserial](https://github.com/pyserial/pyserial) | 3.5 | Chris Liechti | BSD-3-Clause |

## Thanks

To the Open Steno Project and everyone who has made stenography free to learn and to use.

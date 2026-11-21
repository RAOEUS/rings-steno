#!/usr/bin/env python3
"""Builds Plover's two C helpers, plover_stroke and rtf_tokenize, for the phone.

Plover needs both, PyPI has them only as source or desktop builds, and Chaquopy cannot compile C during the app build.
This takes the unmodified source releases from PyPI, compiles them with the Android NDK against the Python that
Chaquopy puts in the app, and writes wheels into wheels/ for the app build to install.

Run it again only when the Python version, a package version or the ABI changes:
    python native/build_wheels.py
Needs: pip, the NDK ($ANDROID_NDK_HOME or the newest under $ANDROID_HOME/ndk), and Chaquopy's Python target in the
Gradle cache (any earlier build of the app has fetched it).
"""
import base64, glob, hashlib, os, subprocess, sys, tarfile, tempfile, zipfile

PY = '3.11'                       # must match the python version in app/build.gradle
ABI, TRIPLE, API = 'arm64-v8a', 'aarch64-linux-android', 24
# name, version, C module, pure files to ship beside it, sha256 of the source release on PyPI
PACKAGES = [('plover_stroke', '1.1.0', '_plover_stroke', ['plover_stroke.py'], 'de03b23f4aee66b65f69f7d4ecc4233681b43541502d86bf14fde29eaa72d153'),
            ('rtf_tokenize', '1.0.1', 'rtf_tokenize', [], '9020aa801502b5de60be2b7709b9ce4cb29cd70df6f5fc4953315cf158035ad2')]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'wheels')


def ndk():
    home = os.environ.get('ANDROID_NDK_HOME')
    if not home:
        found = sorted(glob.glob(os.path.join(os.environ.get('ANDROID_HOME', '/opt/android-sdk'), 'ndk', '*')))
        if not found:
            sys.exit('No NDK found: set ANDROID_NDK_HOME')
        home = found[-1]
    return os.path.join(home, 'toolchains', 'llvm', 'prebuilt', 'linux-x86_64', 'bin', '%s%d-clang' % (TRIPLE, API))


def target(work):
    """Headers and libpython, from the same archive Chaquopy builds the app's Python from."""
    zips = glob.glob(os.path.expanduser('~/.gradle/caches/modules-2/files-2.1/com.chaquo.python/target/%s.*/*/target-*-%s.zip' % (PY, ABI)))
    if not zips:
        sys.exit('Chaquopy target for Python %s not in the Gradle cache: build the app once first' % PY)
    with zipfile.ZipFile(sorted(zips)[-1]) as z:
        z.extractall(work, [n for n in z.namelist() if n.startswith('include/python') or n.endswith('libpython%s.so' % PY)])
    return os.path.join(work, 'include', 'python' + PY), os.path.join(work, 'jniLibs', ABI)


def record(path, data):
    return '%s,sha256=%s,%d' % (path, base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode(), len(data))


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        include, libdir = target(work)
        for name, version, module, extra, sha256 in PACKAGES:
            subprocess.check_call([sys.executable, '-m', 'pip', 'download', '-q', '--no-deps', '--no-binary', ':all:', '-d', work, '%s==%s' % (name, version)])
            sdist = os.path.join(work, '%s-%s.tar.gz' % (name, version))
            if hashlib.sha256(open(sdist, 'rb').read()).hexdigest() != sha256:
                sys.exit('%s %s is not the source release this script was written against: refusing to build it' % (name, version))
            with tarfile.open(sdist) as t:
                t.extractall(work)
            src = os.path.join(work, '%s-%s' % (name, version))
            so = os.path.join(work, module + '.so')
            subprocess.check_call([ndk(), '-shared', '-fPIC', '-O2', '-I' + include, os.path.join(src, module + '.c'),
                                   '-L' + libdir, '-lpython' + PY, '-Wl,-z,max-page-size=16384', '-o', so])
            tag = 'cp%s-cp%s-android_21_%s' % (PY.replace('.', ''), PY.replace('.', ''), ABI.replace('-', '_'))
            info = '%s-%s.dist-info/' % (name, version)
            files = {module + '.so': open(so, 'rb').read()}
            for f in extra:
                files[f] = open(os.path.join(src, f), 'rb').read()
            files[info + 'METADATA'] = open(os.path.join(src, 'PKG-INFO'), 'rb').read()
            files[info + 'WHEEL'] = ('Wheel-Version: 1.0\nGenerator: rings build_wheels.py\nRoot-Is-Purelib: false\nTag: %s\n' % tag).encode()
            files[info + 'RECORD'] = ('\n'.join([record(p, d) for p, d in files.items()] + [info + 'RECORD,,']) + '\n').encode()
            wheel = os.path.join(OUT, '%s-%s-0-%s.whl' % (name, version, tag))
            with zipfile.ZipFile(wheel, 'w', zipfile.ZIP_DEFLATED) as z:
                for p, d in files.items():
                    z.writestr(p, d)
            print('built', os.path.relpath(wheel))


if __name__ == '__main__':
    main()

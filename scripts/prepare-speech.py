"""Restore the exact Android speech assets used by quill 0.1.5."""
import argparse
import hashlib
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "modules/qingri-device/android"
RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
MODEL = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09"


def acquire(cache, name, url, digest):
    path = cache / name
    if not path.exists():
        with tempfile.NamedTemporaryFile(dir=cache, delete=False) as temp:
            partial = Path(temp.name)
        try:
            urllib.request.urlretrieve(url, partial)
            verify(partial, digest)
            partial.replace(path)
        finally:
            partial.unlink(missing_ok=True)
    else:
        verify(path, digest)
    return path


def verify(path, digest):
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(block)
    if hasher.hexdigest() != digest:
        raise ValueError(f"SHA-256 mismatch: {path}")


def save(stream, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with stream, path.open("wb") as out:
        shutil.copyfileobj(stream, out)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / "work/speech-cache")
    cache = parser.parse_args().cache
    cache.mkdir(parents=True, exist_ok=True)
    aar = acquire(cache, "sherpa-onnx-1.12.20.aar",
                  f"{RELEASES}/v1.12.20/sherpa-onnx-1.12.20.aar",
                  "e3905b1258b577d8d374db798618602ceaaff5805cbf9b356ab25267cd98144d")
    model = acquire(cache, "sensevoice-20250909.tar.bz2",
                    f"{RELEASES}/asr-models/{MODEL}.tar.bz2",
                    "7305f7905bfcf77fa0b39388a313f3da35c68d971661a65475b56fb2162c8e63")
    with zipfile.ZipFile(aar) as archive:
        save(archive.open("classes.jar"), ANDROID / "libs/sherpa-onnx-1.12.20.jar")
        for name in archive.namelist():
            if name.startswith("jni/arm64-v8a/") and name.endswith(".so"):
                save(archive.open(name), ANDROID / "src/main/jniLibs/arm64-v8a" / Path(name).name)
    with tarfile.open(model, "r:bz2") as archive:
        for name in ("model.int8.onnx", "tokens.txt"):
            member = next(item for item in archive if item.isfile() and Path(item.name).name == name)
            save(archive.extractfile(member), ANDROID / "src/main/assets/sensevoice-20250909" / name)
    print("Android arm64 speech assets are ready.")


if __name__ == "__main__":
    main()

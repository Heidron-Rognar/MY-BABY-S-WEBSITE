#!/usr/bin/env python3
"""Rebuild only the 100 selected WEB verses from a pinned public-domain source.

Run: python3 scripts/import-web-verses.py [--archive /path/to/snapshot.zip]
The source archive stays in memory; the full Bible is never added to Git.
"""
import argparse
import io
import json
from pathlib import Path
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "68669ba3be9719ae4d1135b19d9e0b6587b7c356"
REPOSITORY = "TehShrike/world-english-bible"
URL = f"https://codeload.github.com/{REPOSITORY}/zip/{COMMIT}"


def build(archive):
    module = (ROOT / "public/daily-verses.js").read_text()
    reference_block = module.split("export const VERSE_REFERENCES = Object.freeze([", 1)[1].split("]);", 1)[0]
    references = re.findall(r'^  "([^"]+)",$', reference_block, re.MULTILINE)
    if len(references) != 100 or len(set(references)) != 100:
        raise ValueError("Expected exactly 100 unique references")
    verses = {}
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        prefix = f"world-english-bible-{COMMIT}/"
        for reference in references:
            book, position = reference.rsplit(" ", 1)
            chapter, verse = map(int, position.split(":"))
            filename = "psalms" if book == "Psalm" else book.lower().replace(" ", "")
            rows = json.loads(source.read(f"{prefix}json/{filename}.json"))
            parts = [row["value"] for row in rows
                     if row.get("chapterNumber") == chapter and row.get("verseNumber") == verse
                     and row.get("type") in ("paragraph text", "line text")]
            if not parts:
                raise ValueError(f"Missing source text for {reference}")
            # Join verse sections/poetry lines, normalizing whitespace only.
            text = re.sub(r"\s+", " ", " ".join(parts)).strip()
            if not text or re.search(r"<[^>]+>", text):
                raise ValueError(f"Invalid source text for {reference}")
            verses[reference] = text
    return (
        "// World English Bible (WEB), public domain. Wording is not paraphrased.\n"
        "// Source: eBible.org classic WEB HTML (14 June 2017), parsed in this snapshot:\n"
        f"// https://github.com/{REPOSITORY}/tree/{COMMIT}\n"
        "// Rebuild with: python3 scripts/import-web-verses.py\n"
        "// Only whitespace between verse sections is normalized; footnotes are excluded.\n"
        "export const WEB_VERSES = Object.freeze("
        + json.dumps(verses, ensure_ascii=False, indent=2) + ");\n"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Use an already-downloaded pinned source archive")
    args = parser.parse_args()
    archive = args.archive.read_bytes() if args.archive else urllib.request.urlopen(URL, timeout=60).read()
    output = build(archive)
    destination = ROOT / "public/web-verses.js"
    destination.write_text(output)
    print(f"Wrote 100 WEB verses to {destination.relative_to(ROOT)}")

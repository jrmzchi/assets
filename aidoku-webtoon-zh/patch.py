#!/usr/bin/env python3
"""Patch Amqx's WEBTOON v5 source into a dedicated zh-Hant Aidoku source.

Run at the root of a checkout of https://github.com/Amqx/sources.
No modification to the upstream repository is needed.
"""
from pathlib import Path
import json
import shutil

original = Path("sources/multi.webtoon")
target = Path("sources/zh.webtoon")
if not original.is_dir():
    raise SystemExit("Run this script in the Amqx/sources checkout")
if target.exists():
    shutil.rmtree(target)
shutil.copytree(original, target)
helper = target / "src/helper.rs"
s = helper.read_text()
start = s.index("/// Returns the currently selected language code")
end = s.index("/// Returns the base URL without language path component.")
s = s[:start] + '''/// Dedicated Traditional Chinese source; do not use Aidoku language defaults.
pub fn get_lang_code() -> String {
    String::from("zh-hant")
}

''' + s[end:]
# The upstream code uses locale-less series URLs, which may fall back to English.
s = s.replace('format!("{BASE_URL_DESKTOP}/episodeList?titleNo={manga_id}")',
              'format!("{}/episodeList?titleNo={manga_id}", get_base_url(false))')
s = s.replace('format!("{BASE_URL_DESKTOP}/challenge/episodeList?titleNo={canvas_id}")',
              'format!("{}/challenge/episodeList?titleNo={canvas_id}", get_base_url(false))')
s = s.replace('"{BASE_URL_DESKTOP}/challenge/viewer?titleNo={clean_manga_id}&episodeNo={clean_chapter_id}"',
              '"{}/challenge/viewer?titleNo={clean_manga_id}&episodeNo={clean_chapter_id}"')
s = s.replace('"{BASE_URL_DESKTOP}/viewer?titleNo={manga_id}&episodeNo={chapter_id}"',
              '"{}/viewer?titleNo={manga_id}&episodeNo={chapter_id}"')
# Supply the base-url argument for the two chapter URL format! calls.
s = s.replace('format!(\n            "{}/challenge/viewer?titleNo={clean_manga_id}&episodeNo={clean_chapter_id}"\n        )',
              'format!(\n            "{}/challenge/viewer?titleNo={clean_manga_id}&episodeNo={clean_chapter_id}", get_base_url(false)\n        )')
s = s.replace('format!("{}/viewer?titleNo={manga_id}&episodeNo={chapter_id}")',
              'format!("{}/viewer?titleNo={manga_id}&episodeNo={chapter_id}", get_base_url(false))')
helper.write_text(s)
meta = target / "res/source.json"
d = json.loads(meta.read_text())
d["info"].update({"id": "zh.webtoon", "name": "WEBTOON 繁體中文", "languages": ["zh-Hant"]})
d["config"] = {}
meta.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
cargo = target / "Cargo.toml"
s = cargo.read_text()
s = s.replace('name = "webtoon"', 'name = "webtoon_zh"')
cargo.write_text(s)
print("Created sources/zh.webtoon. Build and test against the Taiwan site before release.")

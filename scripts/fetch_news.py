"""太陽光発電・系統用蓄電池のニュースとプレスリリースを集めて docs/data.json に保存する。"""
import calendar
import hashlib
import html
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
DATA_PATH = ROOT / "docs" / "data.json"
JST = timezone(timedelta(hours=9))
UA = "Mozilla/5.0 (compatible; EnergyNewsBot/1.0)"
EXCLUDE = [re.compile(p) for p in CONFIG.get("exclude_patterns", [])]


def clean(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def norm_title(title):
    # 全角/半角の違いを吸収し、同じ記事を重複登録しない
    title = unicodedata.normalize("NFKC", title)
    # 末尾の「(朝日新聞)」「[京都府]」「(2026年10月2日掲載)」などは配信先ごとの付記なので無視
    title = re.sub(r"(\s*[(\[【][^()\[\]【】]*[)\]】])+\s*$", "", title) or title
    return re.sub(r"[\s「」『』【】\[\]()・、。,.!?:\-–—|]", "", title).lower()


def has_any(text, words):
    for w in words:
        # 英字だけのキーワード（BESS、FITなど）は単語として一致した場合のみ
        if re.fullmatch(r"[A-Za-z]+", w):
            if re.search(rf"(?<![A-Za-z]){w}(?![A-Za-z])", text):
                return True
        elif w in text:
            return True
    return False


def categorize(text):
    return [cat for cat, words in CONFIG["keywords"].items() if has_any(text, words)]


def solar_topic(text):
    """太陽光記事の細分類。config の並び順が優先順位で、最初に当たった1つを返す。"""
    text = unicodedata.normalize("NFKC", text)
    for topic, words in CONFIG.get("solar_topics", {}).items():
        if has_any(text, words):
            return topic
    return "その他"


def entry_time(entry):
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            return datetime.fromtimestamp(calendar.timegm(t), tz=timezone.utc)
    return datetime.now(timezone.utc)


def fetch_feed(feed):
    parsed = feedparser.parse(feed["url"], agent=UA)
    if parsed.bozo and not parsed.entries:
        print(f"  ! 取得失敗: {feed['name']} ({parsed.get('bozo_exception')})")
        return []

    items = []
    for e in parsed.entries:
        title = clean(e.get("title"))
        link = e.get("link", "")
        if not title or not link:
            continue

        source = ""
        src = e.get("source")
        if isinstance(src, dict):
            source = src.get("title", "")
        # Googleニュースは「タイトル - 媒体名」形式なので媒体名を分離
        if "news.google.com" in feed["url"]:
            m = re.match(r"^(.*)\s+-\s+([^-]+)$", title)
            if source and title.endswith(f" - {source}"):
                title = title[: -len(source) - 3].strip()
            elif m:
                title, source = m.group(1).strip(), source or m.group(2).strip()
        source = source or feed["name"]
        # 「… - ニュース - メガソーラービジネス plus」のような媒体内の区分表記や末尾の記号を外す
        title = re.sub(r"\s+-\s+(ニュース|特集|コラム|インタビュー)\s+-\s+.*$", "", title)
        title = re.sub(r"\s*[-–—|｜]+\s*$", "", title)
        # 写真ページ（「写真：」付き）は本記事と同じ内容なので接頭辞を外して重複扱いにする
        title = re.sub(r"^写真[：:]\s*", "", title)
        if any(p.search(title) for p in EXCLUDE) or source in CONFIG.get("exclude_sources", []):
            continue

        summary = clean(e.get("summary", ""))[:200]
        cats = categorize(f"{title} {summary}")
        if not cats:
            if feed.get("require_keyword"):
                continue
            cats = [feed["default_category"]]

        is_release = feed["type"] == "release" or "prtimes.jp" in link or "PR TIMES" in source
        items.append({
            "id": hashlib.sha1(norm_title(title).encode()).hexdigest()[:16],
            "title": title,
            "link": link,
            "source": source,
            "summary": summary if summary != title else "",
            "categories": sorted(set(cats)),
            "type": "release" if is_release else "news",
            "published": entry_time(e).astimezone(JST).isoformat(timespec="minutes"),
        })
    print(f"  {feed['name']}: {len(items)}件")
    return items


def main():
    existing = []
    if DATA_PATH.exists():
        try:
            existing = json.loads(DATA_PATH.read_text(encoding="utf-8")).get("items", [])
        except json.JSONDecodeError:
            pass

    merged = {it["id"]: it for it in existing}
    new_count = 0
    for feed in CONFIG["feeds"]:
        for it in fetch_feed(feed):
            if it["id"] in merged:
                old = merged[it["id"]]
                old["categories"] = sorted(set(old["categories"]) | set(it["categories"]))
                if it["type"] == "release":
                    old["type"] = "release"
            else:
                merged[it["id"]] = it
                new_count += 1

    cutoff = datetime.now(JST) - timedelta(days=CONFIG["keep_days"])
    items = [it for it in merged.values() if datetime.fromisoformat(it["published"]) >= cutoff]
    items.sort(key=lambda it: it["published"], reverse=True)
    items = items[: CONFIG["max_items"]]

    # 細分類は毎回付け直す（config.json の分類語を変えたら過去記事にも反映される）
    for it in items:
        if "solar" in it["categories"]:
            it["topic"] = solar_topic(f"{it['title']} {it['summary']}")
        else:
            it.pop("topic", None)

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps({
        "updated_at": datetime.now(JST).isoformat(timespec="minutes"),
        "solar_topics": [*CONFIG.get("solar_topics", {}), "その他"],
        "items": items,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"新着 {new_count}件 / 合計 {len(items)}件")


if __name__ == "__main__":
    main()

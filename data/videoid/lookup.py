"""곡 하나를 캐시와 함께 조회한다. 표준입력이나 --json-file 로 JSON 한 건을 넘긴다."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from videoid.resolver import norm, resolve

CACHE = Path(os.environ.get('ODY_VIDEOID_CACHE')
             or Path(__file__).resolve().parent / 'cache.sqlite')
ALGORITHM_VERSION = 'playable_decision_v5_embed'


def _key(track: dict) -> str:
    fields = ('id', 'mbid', 'title', 'artist', 'album', 'duration', 'release_year', 'isrc')
    normalized = {name: norm(track.get(name, '')) for name in fields}
    normalized['algorithm_version'] = ALGORITHM_VERSION
    return hashlib.sha256(json.dumps(normalized, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()


def _ttl(status: str) -> timedelta:
    if status.startswith('matched_official_'):
        return timedelta(days=30)
    if status == 'retry_pending':
        return timedelta(minutes=10)
    return timedelta(days=1)


def lookup(track: dict, refresh: bool = False, cache_path: Path = CACHE) -> dict:
    track = {name: value for name, value in track.items() if name not in ('video_id', 'youtube_url')}
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    key = _key(track)
    now = datetime.now(timezone.utc)
    with closing(sqlite3.connect(cache_path, timeout=15)) as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE IF NOT EXISTS matches '
                   '(cache_key TEXT PRIMARY KEY, track_json TEXT NOT NULL, result_json TEXT NOT NULL, '
                   'checked_at TEXT NOT NULL, expires_at TEXT NOT NULL)')
        row = db.execute('SELECT result_json,expires_at FROM matches WHERE cache_key=?', (key,)).fetchone()
        if row and not refresh and datetime.fromisoformat(row[1]) > now:
            return {**json.loads(row[0]), 'cache_hit': True}
    result = resolve(track)
    expires = now + _ttl(result['status'])
    with closing(sqlite3.connect(cache_path, timeout=15)) as db:
        db.execute('INSERT INTO matches(cache_key,track_json,result_json,checked_at,expires_at) '
                   'VALUES (?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET '
                   'track_json=excluded.track_json,result_json=excluded.result_json,'
                   'checked_at=excluded.checked_at,expires_at=excluded.expires_at',
                   (key, json.dumps(track, ensure_ascii=False), json.dumps(result, ensure_ascii=False),
                    result['checked_at'], expires.isoformat()))
        db.commit()
    return {**result, 'cache_hit': False}


def main() -> None:
    parser = argparse.ArgumentParser(description='Resolve one song to a verified YouTube video ID')
    parser.add_argument('--refresh', action='store_true', help='ignore an unexpired cache entry')
    parser.add_argument('--json-file', type=Path, help='read a track JSON file instead of standard input')
    args = parser.parse_args()
    try:
        raw = args.json_file.read_text(encoding='utf-8-sig') if args.json_file else sys.stdin.read()
        track = json.loads(raw)
        result = lookup(track, refresh=args.refresh)
        print(json.dumps(result, ensure_ascii=False))
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(json.dumps({'status': 'input_or_storage_error', 'video_id': None,
                          'error': str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)


if __name__ == '__main__':
    main()

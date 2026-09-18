"""videoid API — backend `VideoIdApiClient` 가 호출하는 `GET /videoid` 계약 구현 (S15P21A405-441).

백엔드는 `{best: {videoId}}` 만 읽는다(`VideoIdApiResponse`). 재생 불가면 `best` 가 null 이다.
나머지 필드는 운영·검토용이며 백엔드가 무시한다.

실행:
    python -m videoid.api --port 8001          # data/ 를 작업 디렉터리로
    python data/videoid/api.py --port 8001     # 직접 실행도 같다
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from videoid.lookup import lookup
from videoid.resolver import PLAY_THRESHOLD

LOG = logging.getLogger('videoid')


def _int_or_none(raw: str | None) -> int | None:
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def resolve_request(artist: str, title: str, duration: int | None = None,
                    album: str = '', isrc: str = '', release_year: int | None = None,
                    refresh: bool = False, lookup_fn=lookup) -> dict:
    """Backend-shaped response. `best` is null whenever the track is not playable."""
    track = {'title': title, 'artist': artist, 'album': album, 'duration': duration,
             'release_year': release_year, 'isrc': isrc}
    result = lookup_fn(track, refresh=refresh)
    best = None
    if result.get('play_video_id'):
        guess = result.get('best_guess') or {}
        best = {
            'videoId': result['play_video_id'],
            'youtubeUrl': result['play_youtube_url'],
            'confidence': result['play_confidence'],
            'score': guess.get('score') if result['play_confidence'] == 'best_guess' else None,
        }
    return {
        'best': best,
        'playable': result.get('playable', False),
        'status': result.get('status'),
        'reason': result.get('reason'),
        'threshold': PLAY_THRESHOLD,
        'retryable': result.get('status') == 'retry_pending',
        'cacheHit': result.get('cache_hit', False),
        'checkedAt': result.get('checked_at'),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = 'videoid/1.0'
    protocol_version = 'HTTP/1.1'

    def do_GET(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler naming
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self._send(HTTPStatus.OK, {'status': 'ok', 'threshold': PLAY_THRESHOLD})
            return
        if parsed.path != '/videoid':
            self._send(HTTPStatus.NOT_FOUND, {'best': None, 'error': 'not_found'})
            return

        query = parse_qs(parsed.query)
        artist = (query.get('artist') or [''])[0].strip()
        title = (query.get('title') or [''])[0].strip()
        if not artist or not title:
            self._send(HTTPStatus.BAD_REQUEST,
                       {'best': None, 'error': 'artist_and_title_required'})
            return
        try:
            body = resolve_request(
                artist=artist, title=title,
                duration=_int_or_none((query.get('duration') or [None])[0]),
                album=(query.get('album') or [''])[0].strip(),
                isrc=(query.get('isrc') or [''])[0].strip(),
                release_year=_int_or_none((query.get('releaseYear') or [None])[0]),
                refresh=(query.get('refresh') or [''])[0].lower() in ('1', 'true', 'yes'),
            )
        except Exception as exc:  # the backend must get a shaped answer, never a stack trace
            LOG.warning('lookup failed artist=%s title=%s error=%s', artist, title, exc)
            self._send(HTTPStatus.OK, {'best': None, 'playable': False,
                                       'status': 'retry_pending', 'reason': type(exc).__name__,
                                       'retryable': True})
            return
        LOG.info('artist=%s title=%s -> %s %s', artist, title, body['status'],
                 (body['best'] or {}).get('videoId'))
        self._send(HTTPStatus.OK, body)

    def _send(self, code: HTTPStatus, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt: str, *args) -> None:
        LOG.debug(fmt, *args)


def main() -> None:
    parser = argparse.ArgumentParser(description='videoid lookup API')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    LOG.info('listening on http://%s:%d/videoid (threshold %.2f)', args.host, args.port,
             PLAY_THRESHOLD)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()

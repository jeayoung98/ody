"""Accuracy-first, on-demand YouTube video ID lookup. No YouTube Data API key."""
from __future__ import annotations

import html
import re
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher

# Below this likeness a candidate is treated as unplayable rather than guessed at.
PLAY_THRESHOLD = 0.6

# How many guessed candidates may be opened to check they embed. Each check is one network call.
GUESS_EMBED_CHECKS = 3

VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')
ISRC = re.compile(r'\b[A-Z]{2}[A-Z0-9]{3}\d{7}\b', re.I)
EXPLICIT_ISRC = re.compile(r'\bISRC\s*[:#-]?\s*([A-Z]{2}[A-Z0-9]{3}\d{7})\b', re.I)
OFFICIAL_SUFFIX = re.compile(
    r'\s*(?:[\[(]\s*)?(?:official\s+(?:music\s+)?video|official\s+audio)(?:\s*[\])])?\s*$',
    re.I,
)


def norm(value: object) -> str:
    text = unicodedata.normalize('NFKC', html.unescape(str(value or ''))).casefold()
    return ' '.join(re.sub(r'[^\w\s]', ' ', text).split())


def compact(value: object) -> str:
    return norm(value).replace(' ', '')


def channel_matches(artist: str, channel: str) -> bool:
    expected, actual = compact(artist), compact(channel)
    if not expected or not actual:
        return False
    return actual == expected or any(
        actual in (expected + suffix, suffix + expected)
        for suffix in ('topic', 'official', 'officialyoutubechannel', 'vevo')
    )


def title_matches(track_title: str, video_title: str, artist: str) -> bool:
    expected = norm(track_title)
    if not expected:
        return False
    actual = norm(OFFICIAL_SUFFIX.sub('', video_title or ''))
    artist_prefix = norm(artist)
    if artist_prefix and actual.startswith(artist_prefix + ' '):
        actual = actual[len(artist_prefix) + 1:]
    return actual == expected


def isrc_conflicts(source_isrc: str, description: str) -> bool:
    source = {match.upper() for match in ISRC.findall(source_isrc or '')}
    stated = {match.upper() for match in EXPLICIT_ISRC.findall(description or '')}
    return bool(source and stated and source.isdisjoint(stated))


def embeddable(video: dict) -> bool:
    """AGENTS.md rule 6: playback happens in the YouTube IFrame player, so embedding must work."""
    return (video.get('playable_in_embed') is True
            and video.get('availability') == 'public'
            and not video.get('is_live')
            and video.get('live_status') in (None, 'not_live')
            and not (video.get('age_limit') or 0))


def _search(query: str) -> list[dict]:
    import yt_dlp

    options = {
        'quiet': True, 'no_warnings': True, 'extract_flat': True,
        'skip_download': True, 'socket_timeout': 15, 'retries': 1,
    }
    with yt_dlp.YoutubeDL(options) as client:
        data = client.extract_info('ytsearch12:' + query[:250], download=False)
    return [
        {'id': entry.get('id'), 'title': entry.get('title') or '',
         'channel': entry.get('channel') or '', 'duration': entry.get('duration')}
        for entry in (data or {}).get('entries', []) if entry
    ]


def _video(video_id: str) -> dict:
    import yt_dlp

    options = {
        'quiet': True, 'no_warnings': True, 'skip_download': True,
        'socket_timeout': 15, 'retries': 1,
    }
    with yt_dlp.YoutubeDL(options) as client:
        data = client.extract_info('https://www.youtube.com/watch?v=' + video_id, download=False)
    return {
        'id': video_id, 'title': data.get('title') or '',
        'channel': data.get('channel') or '', 'description': data.get('description') or '',
        'duration': data.get('duration'), 'availability': data.get('availability'),
        'playable_in_embed': data.get('playable_in_embed'), 'is_live': data.get('is_live'),
        'live_status': data.get('live_status'), 'age_limit': data.get('age_limit'),
    }


def _basic_match(track: dict, video: dict) -> bool:
    if not title_matches(track['title'], video.get('title', ''), track['artist']):
        return False
    if not channel_matches(track['artist'], video.get('channel', '')):
        return False
    if video.get('duration') is None or video.get('availability') != 'public':
        return False
    if not embeddable(video):
        return False
    source_duration = track.get('duration')
    if source_duration is None:
        return False
    if abs(float(video['duration']) - float(source_duration)) > 2:
        return False
    if isrc_conflicts(track.get('isrc', ''), video.get('description', '')):
        return False
    source_year = str(track.get('release_year') or '').strip()
    released = re.search(r'\bReleased\s+on:\s*(\d{4})-', video.get('description', ''), re.I)
    if source_year.isdigit() and len(source_year) == 4 and released and source_year != released.group(1):
        return False
    return True


def _snippet_compatible(track: dict, candidate: dict) -> bool:
    if not title_matches(track['title'], candidate.get('title', ''), track['artist']):
        return False
    if not channel_matches(track['artist'], candidate.get('channel', '')):
        return False
    duration, source = candidate.get('duration'), track.get('duration')
    return duration is None or source is None or abs(float(duration) - float(source)) <= 2


def _official_kind(track: dict, video: dict) -> str | None:
    if not _basic_match(track, video):
        return None
    album = norm(track.get('album', ''))
    if len(album) < 4:
        return None
    description = video.get('description', '')
    lines = [line.strip() for line in description.splitlines() if line.strip()]
    if ('auto-generated by youtube' in description.lower()
            or (lines and lines[0].lower().startswith('provided to youtube by'))):
        if len(lines) >= 3 and lines[0].lower().startswith('provided to youtube by') \
                and 'auto-generated by youtube' in description.lower():
            parts = [part.strip() for part in lines[1].split('·')]
            if (len(parts) >= 2 and norm(parts[0]) == norm(track['title'])
                    and any(compact(part) == compact(track['artist']) for part in parts[1:])
                    and norm(lines[2]) == album):
                return 'matched_official_art_track'
        return None
    # For manually uploaded official videos the album must appear in the description.
    normalized_description = ' ' + norm(description) + ' '
    if (' ' + album + ' ') not in normalized_description or \
            (' ' + norm(track['artist']) + ' ') not in normalized_description:
        return None
    if re.search(r'\bofficial\s+audio\b', video['title'], re.I):
        return 'matched_official_audio'
    if re.search(r'\bofficial\s+(?:music\s+)?video\b', video['title'], re.I):
        return 'matched_official_music_video'
    return None


def _guess_score(track: dict, candidate: dict) -> float:
    """Loose 0..1 likeness for a search snippet. Never used to confirm a match."""
    video_title = norm(OFFICIAL_SUFFIX.sub('', candidate.get('title') or ''))
    if not video_title:
        return 0.0
    artist = norm(track['artist'])
    stripped = video_title[len(artist) + 1:] if artist and video_title.startswith(artist + ' ') else video_title
    score = 0.60 * max(SequenceMatcher(None, norm(track['title']), part).ratio()
                       for part in {video_title, stripped})
    channel = compact(candidate.get('channel') or '')
    expected = compact(track['artist'])
    if expected and channel:
        if channel_matches(track['artist'], candidate.get('channel') or ''):
            score += 0.25
        elif expected in channel or channel in expected:
            score += 0.18
        else:
            score += 0.25 * SequenceMatcher(None, expected, channel).ratio()
    if artist and artist in video_title:
        score += 0.05
    duration, source = candidate.get('duration'), track.get('duration')
    if duration is not None and source is not None:
        delta = abs(float(duration) - float(source))
        score += 0.15 if delta <= 2 else (0.10 if delta <= 5 else (0.05 if delta <= 15 else 0.0))
    return round(min(score, 1.0), 4)


def _best_guess(track: dict, seen: list[dict], video_fn=None,
                min_score: float = PLAY_THRESHOLD, max_checks: int = GUESS_EMBED_CHECKS) -> dict | None:
    """Highest-scoring candidate that actually embeds. Song identity stays a guess, playback does not."""
    scored = [(_guess_score(track, candidate), candidate) for candidate in seen
              if VIDEO_ID.fullmatch(str(candidate.get('id') or ''))]
    ranked = sorted((pair for pair in scored if pair[0] >= min_score),
                    key=lambda pair: pair[0], reverse=True)
    seen_ids = set()
    checks = 0
    for score, candidate in ranked:
        video_id = str(candidate['id'])
        if video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        embed_checked = False
        if video_fn is not None:
            # Budget spent: stop rather than hand back a candidate nobody checked (rule 6).
            if checks >= max_checks:
                return None
            checks += 1
            try:
                if not embeddable(video_fn(video_id)):
                    continue
                embed_checked = True
            except Exception:
                continue
        return {'video_id': video_id, 'youtube_url': 'https://www.youtube.com/watch?v=' + video_id,
                'score': score, 'title': candidate.get('title'), 'channel': candidate.get('channel'),
                'duration': candidate.get('duration'), 'verified': False,
                'embed_checked': embed_checked}
    return None


def resolve(track: dict, search_fn=None, video_fn=None) -> dict:
    """Return a video ID only for one unambiguous, verified official recording."""
    title, artist = str(track.get('title') or '').strip(), str(track.get('artist') or '').strip()
    if not title or not artist:
        raise ValueError('title and artist are required')
    search_fn = search_fn or _search
    video_fn = video_fn or _video
    queries = []
    if track.get('album'):
        queries.append(' '.join((artist, title, str(track['album']))))
    queries.append(' '.join((artist, title)))
    queries = list(dict.fromkeys(queries))
    candidates = {}
    seen = []
    errors = []
    for query in queries:
        try:
            for candidate in search_fn(query):
                seen.append(candidate)
                video_id = str(candidate.get('id') or '')
                if VIDEO_ID.fullmatch(video_id) and _snippet_compatible(track, candidate):
                    candidates.setdefault(video_id, candidate)
        except Exception as exc:
            errors.append(type(exc).__name__ + ': ' + str(exc)[:160])
    if errors:
        return _result('retry_pending', None, 'search_failed', errors=errors)
    guess = _best_guess(track, seen, video_fn)
    if not candidates:
        return _result('review_required' if seen else 'no_candidate_in_search',
                       None, 'no_compatible_search_candidate' if seen else 'no_search_candidates',
                       guess=guess)
    # Search snippets are only hints. Full video details decide every match.
    if len(candidates) > 25:
        return _result('review_required', None, 'too_many_candidates', guess=guess)
    matches = {'matched_official_art_track': [], 'matched_official_audio': [],
               'matched_official_music_video': []}
    checked = []
    for video_id in candidates:
        try:
            video = video_fn(video_id)
        except Exception as exc:
            errors.append(type(exc).__name__ + ': ' + str(exc)[:160])
            continue
        kind = _official_kind(track, video)
        checked.append({'video_id': video_id, 'title': video.get('title'),
                        'channel': video.get('channel'), 'duration': video.get('duration'),
                        'official_kind': kind})
        if kind:
            matches[kind].append(video)
    if errors:
        return _result('retry_pending', None, 'video_detail_failed', checked, errors, guess)
    for kind, found in matches.items():
        if len(found) > 1:
            return _result('ambiguous', None, 'multiple_' + kind, checked, guess=guess)
        if len(found) == 1:
            video = found[0]
            return _result(kind, video['id'], 'official_metadata_verified', checked)
    return _result('review_required', None, 'official_recording_not_proven', checked, guess=guess)


def _result(status: str, video_id: str | None, reason: str,
            checked: list | None = None, errors: list | None = None,
            guess: dict | None = None) -> dict:
    return {
        'status': status, 'video_id': video_id,
        'youtube_url': 'https://www.youtube.com/watch?v=' + video_id if video_id else None,
        'reason': reason, 'checked_at': datetime.now(timezone.utc).isoformat(),
        'candidates_checked': checked or [], 'errors': errors or [],
        'best_guess': guess,
        **_playback(video_id, guess),
    }


def _playback(video_id: str | None, guess: dict | None) -> dict:
    """One decision the player can act on: play this ID, or show it as unplayable."""
    play_id = video_id or (guess['video_id'] if guess and guess['score'] >= PLAY_THRESHOLD else None)
    return {
        'playable': play_id is not None,
        'play_video_id': play_id,
        'play_youtube_url': 'https://www.youtube.com/watch?v=' + play_id if play_id else None,
        'play_confidence': 'verified' if video_id else ('best_guess' if play_id else 'unplayable'),
    }

# -*- coding: utf-8 -*-
"""메모리를 아끼는 컬럼 표현 (spec 10 T1 보조).

6.6M 행 카탈로그를 numpy object 배열(파이썬 str)로 들면 상주 5.7GB 가 나온다.
측정: 2026-09-10, coords 424MB 를 빼고도 문자열만 3GB 넘음. AC5 예산은 3GB, app-node
목표는 2GB(HANDOVER_TEAM §5)라 그대로는 못 올린다.

그래서 문자열을 두 갈래로 나눈다.
  비교만 하는 컬럼(canonical) → 정수 코드만 남기고 사전은 버린다.
  화면에 나가는 컬럼(artist, title, leaf_id) → 정수 코드 + 유일값 사전.
      6.6M 개 복사본 대신 유일값 하나씩만 든다. artist 582,973 / title 4,162,407 개.
  mbid → UUID 이므로 uint64 두 개로 쪼개 들고, 출력할 때 문자열로 되돌린다.

코드가 같으면 원문이 같다. 해시가 아니라 사전 인코딩이라 충돌이 없다.
결측·빈 문자열은 코드 -1 이다.
"""
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc

NULL = -1


class CodedColumn(object):
    """정수 코드로 든 문자열 컬럼. `values` 가 None 이면 비교 전용이다."""

    __slots__ = ("codes", "values")

    def __init__(self, codes, values=None):
        self.codes = codes            # int32, 길이 N. -1 = 없음
        self.values = values          # pyarrow StringArray(유일값) 또는 None

    def __len__(self):
        return len(self.codes)

    def get(self, row):
        """행 하나의 원문. 사전을 버린 컬럼이면 None."""
        if self.values is None:
            return None
        code = int(self.codes[row])
        return None if code == NULL else self.values[code].as_py()

    def take(self, rows):
        """여러 행의 원문 목록. 반환할 10~20개에만 쓴다."""
        if self.values is None:
            return [None] * len(rows)
        out = []
        for r in rows:
            code = int(self.codes[r])
            out.append(None if code == NULL else self.values[code].as_py())
        return out

    @property
    def nbytes(self):
        n = self.codes.nbytes
        if self.values is not None:
            n += sum(b.size for b in self.values.buffers() if b is not None)
        return n


def encode(array, keep_values=True):
    """arrow 문자열 배열 → CodedColumn. 빈 문자열은 결측과 같게 -1 로 둔다."""
    array = array.combine_chunks() if isinstance(array, pa.ChunkedArray) else array
    blanked = pc.if_else(pc.equal(pc.utf8_trim_whitespace(array), ""), pa.nulls(len(array), pa.string()), array)
    dictionary = pc.dictionary_encode(blanked)
    codes = dictionary.indices.to_numpy(zero_copy_only=False)
    codes = np.where(np.isnan(codes.astype("float64")) if codes.dtype.kind == "f" else False, NULL, codes)
    codes = np.nan_to_num(codes, nan=NULL).astype(np.int32) if codes.dtype.kind == "f" else codes.astype(np.int32)
    if dictionary.indices.null_count:
        mask = np.asarray(dictionary.indices.is_null())
        codes[mask] = NULL
    return CodedColumn(codes, dictionary.dictionary if keep_values else None)


class MbidIndex(object):
    """소문자 UUID 를 uint64 두 개로 든다. 문자열 6.6M 개(≈600MB) 대신 106MB."""

    __slots__ = ("hi", "lo", "_order")

    def __init__(self, hi, lo):
        self.hi = hi
        self.lo = lo
        self._order = None

    def __len__(self):
        return len(self.hi)

    @classmethod
    def from_strings(cls, array):
        array = array.combine_chunks() if isinstance(array, pa.ChunkedArray) else array
        raw = np.frombuffer(array.buffers()[2], dtype=np.uint8)
        offsets = np.asarray(array.buffers()[1].to_pybytes() and
                             np.frombuffer(array.buffers()[1], dtype=np.int32))
        width = int(offsets[1] - offsets[0])
        if width != 36 or not np.all(np.diff(offsets) == 36):
            # 길이가 제각각이면 UUID 가정을 못 쓴다. 느리지만 안전한 경로.
            hexed = np.array([s.replace("-", "") for s in array.to_pylist()], dtype=object)
            hi = np.array([int(h[:16], 16) for h in hexed], dtype=np.uint64)
            lo = np.array([int(h[16:], 16) for h in hexed], dtype=np.uint64)
            return cls(hi, lo)
        chars = raw[offsets[0]:offsets[-1]].reshape(-1, 36)
        keep = np.ones(36, dtype=bool)
        keep[[8, 13, 18, 23]] = False           # 하이픈 자리
        digits = chars[:, keep]                  # (N, 32) 16진수 문자
        nib = np.where(digits >= ord("a"), digits - (ord("a") - 10), digits - ord("0")).astype(np.uint64)
        weights = (np.uint64(16) ** np.arange(15, -1, -1, dtype=np.uint64))
        hi = (nib[:, :16] * weights).sum(axis=1, dtype=np.uint64)
        lo = (nib[:, 16:] * weights).sum(axis=1, dtype=np.uint64)
        return cls(hi, lo)

    def row(self, mbid):
        """UUID 문자열 → 행 인덱스. 없으면 None. 정렬 인덱스 이진 탐색."""
        text = str(mbid).strip().lower().replace("-", "")
        if len(text) != 32:
            return None
        try:
            hi, lo = np.uint64(int(text[:16], 16)), np.uint64(int(text[16:], 16))
        except ValueError:
            return None
        if self._order is None:
            self._order = np.lexsort((self.lo, self.hi)).astype(np.int64)
        sorted_hi, sorted_lo = self.hi[self._order], self.lo[self._order]
        left = np.searchsorted(sorted_hi, hi, side="left")
        right = np.searchsorted(sorted_hi, hi, side="right")
        if left == right:
            return None
        pos = left + np.searchsorted(sorted_lo[left:right], lo)
        if pos >= right or sorted_lo[pos] != lo:
            return None
        return int(self._order[pos])

    def text(self, row):
        """행 → 소문자 UUID 문자열."""
        h = "{:016x}{:016x}".format(int(self.hi[row]), int(self.lo[row]))
        return "-".join([h[:8], h[8:12], h[12:16], h[16:20], h[20:]])

    @property
    def nbytes(self):
        n = self.hi.nbytes + self.lo.nbytes
        return n + (self._order.nbytes if self._order is not None else 0)

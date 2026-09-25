import { MAP_SONGS_STORE } from "@/constants";
import type { MapPoint } from "@/types";

/**
 * 지도 1겹(전 우주) 상주 집합을 브라우저 IndexedDB 에 저장한다 (S15P21A405-680).
 *
 * **localStorage 가 아니라 IndexedDB 인 이유**: 5,745곡이 JSON 으로 1.6MB 다. localStorage 는 문자열을 UTF-16 으로
 * 담아 두 배가 되고(한도 보통 5MB), 읽고 쓰는 것이 전부 동기라 그동안 화면이 멈춘다. IndexedDB 는 객체를 그대로
 * 담고 읽기가 비동기다 — 데스크톱에서 읽기 13~15ms · 쓰기 35~63ms 였다(배포본에서 임시 DB 로 잰 값).
 *
 * **못 쓰면 조용히 빠진다.** 사생활 보호 모드·저장 공간 부족·IndexedDB 가 없는 환경이면 읽기는 `null`, 쓰기는
 * 아무것도 안 한다. 부르는 쪽(`use-map-songs-query`)은 그때 지금처럼 네트워크로 받는다.
 *
 * 곡 정보는 사용자마다 같은 전 우주 집합이라 누구 것인지 가르지 않는다.
 */
export interface TopLevelSnapshot {
  /** 저장한 곡 모양의 판. `MAP_SONGS_STORE.version` 과 다르면 쓰지 않는다 */
  v: number;
  savedAt: number;
  points: MapPoint[];
}

/** 이 저장본을 그대로 그려도 되는가 — 판이 같고, 너무 오래되지 않았고, 곡이 들어 있다 */
export function isUsableSnapshot(snapshot: unknown, now: number): snapshot is TopLevelSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false;
  const s = snapshot as Partial<TopLevelSnapshot>;
  if (s.v !== MAP_SONGS_STORE.version) return false;
  if (typeof s.savedAt !== "number" || !Number.isFinite(s.savedAt)) return false;
  // 기기 시계가 뒤로 갔거나 앞으로 튄 저장본도 믿지 않는다 — 나이를 셀 수 없다
  const age = now - s.savedAt;
  if (age < 0 || age > MAP_SONGS_STORE.maxAgeMs) return false;
  return Array.isArray(s.points) && s.points.length > 0;
}

/**
 * 저장소를 열어 요청 하나를 돌리고, **그 트랜잭션이 끝난 뒤** 결과를 돌려준다.
 * 요청은 `onsuccess` 안에서 바로 건다 — 약속(Promise)을 한 번 거친 뒤 걸면 브라우저에 따라 트랜잭션이 이미 닫혀 있다.
 */
function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const open = indexedDB.open(MAP_SONGS_STORE.db, MAP_SONGS_STORE.dbVersion);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(MAP_SONGS_STORE.store)) db.createObjectStore(MAP_SONGS_STORE.store);
      };
      open.onerror = () => resolve(null);
      open.onblocked = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction(MAP_SONGS_STORE.store, mode);
          const req = run(tx.objectStore(MAP_SONGS_STORE.store));
          tx.oncomplete = () => {
            db.close();
            resolve(req ? (req.result as T) : null);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/** 저장해 둔 1겹. 없거나 못 쓰는 저장본이면 `null` */
export async function readTopLevelSongs(now: number = Date.now()): Promise<MapPoint[] | null> {
  const snapshot = await withStore<unknown>("readonly", (store) => store.get(MAP_SONGS_STORE.key));
  return isUsableSnapshot(snapshot, now) ? snapshot.points : null;
}

/** 1겹을 저장한다. 빈 목록은 저장하지 않는다 — 다음 방문에 빈 우주를 그리게 된다 */
export async function writeTopLevelSongs(points: readonly MapPoint[], now: number = Date.now()): Promise<void> {
  if (points.length === 0) return;
  const snapshot: TopLevelSnapshot = { v: MAP_SONGS_STORE.version, savedAt: now, points: [...points] };
  await withStore("readwrite", (store) => {
    store.put(snapshot, MAP_SONGS_STORE.key);
  });
}

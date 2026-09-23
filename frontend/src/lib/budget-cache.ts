/**
 * **예산으로 재는 LRU 캐시** (S15P21A405-586).
 *
 * 개수로 재던 캐시를 대신한다. 커버 캔버스는 항목마다 크기가 24배까지 차이 난다 —
 * 104px 한 장은 43KB(104×104×4)지만 곡 상세 배경의 512px 은 1MB 다. 개수로 300장을 세면
 * 어떤 때는 13MB 고 어떤 때는 300MB 라, 그 수가 무엇을 막아 주는지 아무도 모른다.
 *
 * **넘쳤다고 통째로 비우지 않는다.** 예전 커버 캐시는 `clear()` 였는데, 그러면 지금 화면에
 * 서 있는 커버까지 같이 날아가서 **가장 바쁜 순간에 재다운로드·재굽기가 한꺼번에 터진다.**
 * 여기서는 가장 오래 안 쓴 것부터 하나씩 내보낸다.
 *
 * 내보낼 때 항목을 망가뜨리지 않는다(캔버스 크기를 0 으로 줄이는 식). 부르는 쪽이 방금 받아
 * 들고 있는 그림이 그 자리에서 빈칸이 될 수 있다 — 참조를 놓으면 GC 가 알아서 걷어간다.
 */
export class BudgetCache<K, V> {
  /** Map 은 넣은 순서를 지킨다 — 앞이 가장 오래 안 쓴 것, 뒤가 방금 쓴 것 */
  private readonly items = new Map<K, V>();
  private used = 0;

  constructor(
    /** 담아 둘 총량(바이트). 넘으면 오래된 것부터 내보낸다 */
    private readonly budget: number,
    private readonly costOf: (value: V) => number,
  ) {}

  /** 꺼내 쓰면 **가장 최근 것**이 된다 — 이 한 줄이 LRU 를 만든다 */
  get(key: K): V | undefined {
    const hit = this.items.get(key);
    if (hit === undefined) return undefined;
    this.items.delete(key);
    this.items.set(key, hit);
    return hit;
  }

  /** 있는지만 본다. **순서를 건드리지 않는다** — 고를 후보를 훑는 것은 쓴 것이 아니다 */
  has(key: K): boolean {
    return this.items.has(key);
  }

  set(key: K, value: V): V {
    const prev = this.items.get(key);
    if (prev !== undefined) this.used -= this.costOf(prev);
    this.items.delete(key);
    this.items.set(key, value);
    this.used += this.costOf(value);
    /**
     * **방금 넣은 것은 남긴다.** 예산보다 큰 한 장이 들어와도 그것만은 서 있어야 한다 —
     * 안 그러면 넣자마자 사라져서 부르는 쪽이 영원히 다시 만든다.
     */
    while (this.used > this.budget && this.items.size > 1) {
      const oldest = this.items.keys().next().value as K;
      this.used -= this.costOf(this.items.get(oldest)!);
      this.items.delete(oldest);
    }
    return value;
  }

  delete(key: K): void {
    const prev = this.items.get(key);
    if (prev === undefined) return;
    this.used -= this.costOf(prev);
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
    this.used = 0;
  }

  get size(): number {
    return this.items.size;
  }

  /** 지금 담고 있는 총량(바이트) — 테스트와 계측용 */
  get bytes(): number {
    return this.used;
  }
}

/** 캔버스가 실제로 차지하는 크기. 브라우저는 픽셀당 RGBA 4바이트를 잡는다 */
export const canvasBytes = (c: { width: number; height: number }): number => c.width * c.height * 4;

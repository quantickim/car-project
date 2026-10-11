import { buildQuery, type EncarClient } from './encar';
import type { EncarListing, EncarPath } from './types';

/** GitHub Actions 가 매일 만들어 두는 매물 데이터 (scripts/snapshot.ts --static) */
export interface StaticListingsFile {
  generatedAt: string;
  /** buildQuery(차종 경로) → 그 차종의 전체 매물 */
  results: Record<string, { total: number; listings: EncarListing[] }>;
}

/**
 * 정적 배포(GitHub Pages)용 클라이언트. 엔카를 직접 호출할 수 없으므로 미리 수집한 JSON 에서 찾는다.
 * 기본 카탈로그 차종만 조회되고, 분류 조회(차종 추가)는 지원하지 않는다.
 */
export function createStaticClient(url: string): EncarClient & { generatedAt: () => Promise<string> } {
  let file: Promise<StaticListingsFile> | undefined;
  const load = () =>
    (file ??= fetch(url).then((r) => {
      if (!r.ok) throw new Error(`데이터 파일을 불러오지 못했습니다 (${r.status})`);
      return r.json() as Promise<StaticListingsFile>;
    }));

  return {
    async searchListings(path: EncarPath) {
      const hit = (await load()).results[buildQuery(path)];
      if (!hit) throw new Error('배포판에는 기본 차종 데이터만 있습니다. 직접 추가한 차종은 로컬 서버에서 확인하세요');
      return hit;
    },
    async fetchFacets() {
      throw new Error('배포판에서는 엔카 분류를 조회할 수 없습니다');
    },
    generatedAt: async () => (await load()).generatedAt,
  };
}

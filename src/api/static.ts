import { buildQuery, type EncarClient } from './encar';
import type { EncarListing, EncarPath } from './types';

/** GitHub Actions 가 매일 만들어 두는 매물 데이터 (scripts/snapshot.ts --static) */
export interface StaticListingsFile {
  generatedAt: string;
  /** buildQuery(차종 경로) → 그 차종의 전체 매물 */
  results: Record<string, { total: number; listings: EncarListing[] }>;
}

/**
 * 배포판에 함께 들어가는 수집 데이터. 엔카 실시간 조회가 안 될 때(해외 접속 등)만 대신 쓴다.
 * 기본 카탈로그 차종만 들어 있다.
 */
export function createStaticClient(url: string): Pick<EncarClient, 'searchListings'> & { generatedAt: () => Promise<string> } {
  let file: Promise<StaticListingsFile> | undefined;
  const load = () =>
    (file ??= fetch(url).then((r) => {
      if (!r.ok) throw new Error(`데이터 파일을 불러오지 못했습니다 (${r.status})`);
      return r.json() as Promise<StaticListingsFile>;
    }));

  return {
    async searchListings(path: EncarPath) {
      const hit = (await load()).results[buildQuery(path)];
      if (!hit) throw new Error('엔카 실시간 조회에 실패했고, 이 차종은 수집 데이터에도 없습니다');
      return hit;
    },
    generatedAt: async () => (await load()).generatedAt,
  };
}

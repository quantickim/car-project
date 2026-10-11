import { createEncarClient, type EncarClient, type KeyValueStorage } from './encar';
import { createStaticClient } from './static';

/** GitHub Pages 빌드: 엔카 프록시가 없으므로 Actions 가 매일 수집한 JSON 을 읽는다 */
export const IS_STATIC = import.meta.env.VITE_STATIC_DATA === 'true';

const staticClient = IS_STATIC ? createStaticClient(`${import.meta.env.BASE_URL}data/listings.json`) : undefined;

/** 로컬(dev/preview)에서는 vite.config.ts 의 `/encar-api` 프록시로 엔카를 실시간 조회 */
export const encar: EncarClient = staticClient ?? createEncarClient({ baseUrl: '/encar-api', storage: safeSessionStorage() });

/** 정적 데이터 수집 시각 (실시간 모드면 undefined) */
export const dataGeneratedAt = () => staticClient?.generatedAt();

function safeSessionStorage(): KeyValueStorage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

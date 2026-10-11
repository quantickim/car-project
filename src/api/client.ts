import { createEncarClient, type EncarClient, type KeyValueStorage } from './encar';
import { createStaticClient } from './static';

/** GitHub Pages 빌드 여부 (수집해 둔 데이터 파일이 함께 배포됨) */
export const IS_STATIC = import.meta.env.VITE_STATIC_DATA === 'true';

/** 엔카 API는 CORS를 허용하므로 브라우저에서 바로 조회한다 (국내 IP 필요) */
const live = createEncarClient({ baseUrl: 'https://api.encar.com', storage: safeSessionStorage() });

const staticClient = IS_STATIC ? createStaticClient(`${import.meta.env.BASE_URL}data/listings.json`) : undefined;

/** 실시간 조회가 실패했는지 (해외 접속 등). 실패하면 배포판에 포함된 수집 데이터로 대신 보여준다 */
let usingFallback = false;
export const isUsingFallback = () => usingFallback;

export const encar: EncarClient = staticClient
  ? {
      ...live,
      async searchListings(path, range, sort, fresh) {
        try {
          return await live.searchListings(path, range, sort, fresh);
        } catch (e) {
          usingFallback = true;
          return staticClient.searchListings(path).catch(() => Promise.reject(e));
        }
      },
    }
  : live;

/** 배포판에 포함된 수집 데이터의 수집 시각 */
export const dataGeneratedAt = () => staticClient?.generatedAt();

function safeSessionStorage(): KeyValueStorage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

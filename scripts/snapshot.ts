/**
 * 기본 카탈로그 전 차종의 오늘 시세를 data/history.json 에 기록한다.
 * 매일 실행하면(예: crontab `0 9 * * * cd <프로젝트> && npm run snapshot`) 실제 시세 추이가 쌓인다.
 *
 * `--static <dir>` 를 주면 GitHub Pages 같은 정적 배포용으로 매물 데이터(listings.json)와
 * 시세 기록(history.json)을 그 폴더에도 써 둔다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildQuery, createEncarClient } from '../src/api/encar';
import type { StaticListingsFile } from '../src/api/static';
import { DEFAULT_CATALOG } from '../src/data/catalog';
import { filterByBadges } from '../src/lib/analysis';
import { makeSnapshot, type PriceSnapshot } from '../src/lib/history';
import { appendHistory, HISTORY_PATH } from '../server/historyStore';

const staticIdx = process.argv.indexOf('--static');
const staticDir = staticIdx >= 0 ? process.argv[staticIdx + 1] : undefined;

const client = createEncarClient({
  baseUrl: 'https://api.encar.com',
  headers: { Referer: 'https://car.encar.com/', 'User-Agent': 'Mozilla/5.0' },
});

const snapshots: PriceSnapshot[] = [];
const results: StaticListingsFile['results'] = {};
for (const car of DEFAULT_CATALOG) {
  try {
    const result = await client.searchListings(car.encar);
    results[buildQuery(car.encar)] = result;
    const snap = makeSnapshot(car.id, filterByBadges(result.listings, car.badges));
    if (snap) snapshots.push(snap);
    console.log(`${car.name.padEnd(36)} ${snap ? `${snap.count}대, 중앙값 ${snap.median.toLocaleString()}만원` : '매물 없음'}`);
  } catch (e) {
    console.error(`${car.name}: ${String(e)}`);
  }
}

if (Object.keys(results).length === 0) {
  console.error('엔카에서 데이터를 하나도 받지 못했습니다');
  process.exit(1);
}

const history = appendHistory(snapshots);
console.log(`\n${snapshots.length}개 차종 기록 → ${HISTORY_PATH}`);

if (staticDir) {
  mkdirSync(staticDir, { recursive: true });
  const file: StaticListingsFile = { generatedAt: new Date().toISOString(), results };
  writeFileSync(join(staticDir, 'listings.json'), JSON.stringify(file));
  writeFileSync(join(staticDir, 'history.json'), JSON.stringify(history));
  console.log(`정적 데이터 → ${staticDir}`);
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mergeSnapshots, type HistoryFile, type PriceSnapshot } from '../src/lib/history';

export const HISTORY_PATH = resolve(process.cwd(), 'data/history.json');

export function readHistory(): HistoryFile {
  if (!existsSync(HISTORY_PATH)) return { snapshots: [] };
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) as HistoryFile;
  } catch {
    return { snapshots: [] };
  }
}

export function appendHistory(incoming: PriceSnapshot[]): HistoryFile {
  const next = { snapshots: mergeSnapshots(readHistory().snapshots, incoming) };
  writeFileSync(HISTORY_PATH, JSON.stringify(next, null, 1));
  return next;
}

/** Vite 개발/프리뷰 서버용 `/api/history` 핸들러: GET 조회, POST 스냅샷 추가 */
export function historyMiddleware(req: IncomingMessage, res: ServerResponse) {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET') return send(200, readHistory());
  if (req.method !== 'POST') return send(405, { error: 'method not allowed' });

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    try {
      const body = JSON.parse(raw) as { snapshots?: PriceSnapshot[] };
      if (!Array.isArray(body.snapshots)) return send(400, { error: 'snapshots 배열이 필요합니다' });
      send(200, appendHistory(body.snapshots));
    } catch (e) {
      send(400, { error: String(e) });
    }
  });
}

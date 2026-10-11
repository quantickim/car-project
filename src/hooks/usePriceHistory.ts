import { useCallback, useEffect, useState } from 'react';
import { IS_STATIC } from '../api/client';
import type { HistoryFile, PriceSnapshot } from '../lib/history';

/** 로컬: vite 서버의 /api/history (읽기·쓰기), 배포판: Actions 가 매일 쌓는 정적 파일 (읽기 전용) */
const HISTORY_URL = IS_STATIC ? `${import.meta.env.BASE_URL}data/history.json` : '/api/history';
export function usePriceHistory() {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  /** 시세 기록 저장 가능 여부 */
  const [available, setAvailable] = useState(!IS_STATIC);

  useEffect(() => {
    fetch(HISTORY_URL)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryFile>) : Promise.reject(r.status)))
      .then((d) => setSnapshots(d.snapshots))
      .catch(() => setAvailable(false));
  }, []);

  const save = useCallback(async (incoming: PriceSnapshot[]) => {
    if (incoming.length === 0) return;
    const r = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshots: incoming }),
    });
    if (!r.ok) throw new Error(`시세 기록 실패 (${r.status})`);
    setSnapshots(((await r.json()) as HistoryFile).snapshots);
  }, []);

  return { snapshots, available, save };
}

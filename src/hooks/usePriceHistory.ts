import { useCallback, useEffect, useMemo, useState } from 'react';
import { IS_STATIC } from '../api/client';
import { mergeSnapshots, type HistoryFile, type PriceSnapshot } from '../lib/history';
import { useLocalStorage } from './useLocalStorage';

/**
 * 시세 기록.
 * - 로컬 서버: data/history.json (vite 서버의 /api/history) 에 읽고 쓴다
 * - 배포판: 수집 데이터에 든 기록(읽기 전용) + 이 기기에서 분석한 기록(브라우저 저장)을 합쳐 보여준다
 */
const REMOTE_URL = IS_STATIC ? `${import.meta.env.BASE_URL}data/history.json` : '/api/history';

export function usePriceHistory() {
  const [remote, setRemote] = useState<PriceSnapshot[]>([]);
  const [local, setLocal] = useLocalStorage<PriceSnapshot[]>('car:local-history', []);

  useEffect(() => {
    fetch(REMOTE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryFile>) : Promise.reject(r.status)))
      .then((d) => setRemote(d.snapshots))
      .catch(() => {});
  }, []);

  const snapshots = useMemo(() => mergeSnapshots(remote, local), [remote, local]);

  const save = useCallback(
    async (incoming: PriceSnapshot[]) => {
      if (incoming.length === 0) return;
      if (!IS_STATIC) {
        const r = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshots: incoming }),
        }).catch(() => null);
        if (r?.ok) return setRemote(((await r.json()) as HistoryFile).snapshots);
      }
      setLocal((prev) => mergeSnapshots(prev, incoming));
    },
    [setLocal],
  );

  return { snapshots, save };
}

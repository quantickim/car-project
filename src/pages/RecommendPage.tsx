import { useEffect, useMemo, useRef, useState } from 'react';
import { encar } from '../api/client';
import { RetentionChart } from '../components/charts/RetentionChart';
import { ConfidenceTag, GradeBadge } from '../components/GradeBadge';
import type { CatalogCar } from '../data/catalog';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNarrow } from '../hooks/useNarrow';
import type { usePriceHistory } from '../hooks/usePriceHistory';
import { analyzeCar, filterByBadges, gradeOf, type Depreciation } from '../lib/analysis';
import { formatPct, formatPrice, formatSignedPct } from '../lib/format';
import { makeSnapshot, observedChange, type PriceSnapshot } from '../lib/history';
import { median } from '../lib/stats';
import { mapLimit } from '../lib/pool';

interface Row {
  car: CatalogCar;
  count: number;
  medianPrice?: number;
  dep: Depreciation | null;
  error?: string;
}

type Horizon = 3 | 5;

/** 추천 기준: 3년 잔존율 80% 이상(연 -7% 이내)이면서 추정 신뢰도가 '낮음'이 아닌 차 */
const RECOMMEND_RETENTION3 = 0.8;

interface Props {
  catalog: CatalogCar[];
  history: ReturnType<typeof usePriceHistory>;
  onOpenMarket: (carId: string) => void;
}

export function RecommendPage({ catalog, history, onOpenMarket }: Props) {
  const [minHp, setMinHp] = useLocalStorage('car:recommend-min-hp', 400);
  const [horizon, setHorizon] = useLocalStorage<Horizon>('car:recommend-horizon', 5);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedNote, setSavedNote] = useState<string>();
  const started = useRef(false);
  const narrow = useNarrow();

  const candidates = useMemo(() => catalog.filter((c) => c.hp >= minHp), [catalog, minHp]);

  async function run() {
    setProgress({ done: 0, total: catalog.length });
    let done = 0;
    const snaps: PriceSnapshot[] = [];
    // 전 차종을 분석해 두고 마력 기준은 화면에서 거른다 (슬라이더를 움직여도 재요청 없음)
    const result = await mapLimit(catalog, 2, async (car): Promise<Row> => {
      try {
        const { listings } = await encar.searchListings(car.encar);
        const own = filterByBadges(listings, car.badges);
        const snap = makeSnapshot(car.id, own);
        if (snap) snaps.push(snap);
        return {
          car,
          count: own.length,
          medianPrice: own.length ? Math.round(median(own.map((l) => l.Price))) : undefined,
          dep: analyzeCar(car, listings),
        };
      } catch (e) {
        return { car, count: 0, dep: null, error: String(e) };
      } finally {
        setProgress({ done: ++done, total: catalog.length });
      }
    });
    setRows(result);
    setProgress(null);

    // 분석할 때마다 오늘 시세를 기록해 두면 실제 시세 추이가 자동으로 쌓인다
    if (history.available) {
      history
        .save(snaps)
        .then(() => setSavedNote(`오늘 시세 ${snaps.length}개 차종을 기록했습니다`))
        .catch(() => setSavedNote(undefined));
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // 첫 진입 시 한 번만 자동 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = (r: Row) => (r.dep ? (horizon === 3 ? r.dep.retention3 : r.dep.retention5) : -1);
  const visible = rows.filter((r) => r.car.hp >= minHp).sort((a, b) => key(b) - key(a));
  const analyzed = visible.filter((r) => r.dep);
  const reliable = analyzed.filter((r) => r.dep!.confidence !== 'low');
  const picks = reliable.filter((r) => r.dep!.retention3 >= RECOMMEND_RETENTION3);
  // 기준을 넘는 차가 없으면 조건 내에서 상대적으로 가장 잘 버티는 차를 보여준다
  const shown = (picks.length > 0 ? picks : reliable).slice(0, 3);

  const observedFor = (carId: string) => observedChange(history.snapshots.filter((s) => s.carId === carId));

  return (
    <div className="recommend-page">
      <section className="recommend-intro">
        <h2>고출력 가치방어 추천</h2>
        <p className="muted">
          같은 세대·같은 트림 매물을 차령별로 비교해, 지금 사서 3년·5년 뒤 팔 때 가격이 얼마나 남을지 추정합니다. 차령이 1년 늘 때의 가격
          변화를 이상치에 강한 Theil–Sen 회귀로 구하며, 주행거리 증가분도 포함된 값입니다. 매일 기록되는 시세가 쌓이면 '실측 변동'에 실제
          변화율이 함께 표시됩니다.
        </p>
      </section>

      <div className="toolbar">
        <label className="field toolbar__hp">
          최소 출력 <strong className="num">{minHp}마력</strong>
          <input type="range" min={250} max={650} step={10} value={minHp} onChange={(e) => setMinHp(Number(e.target.value))} />
        </label>
        <div className="segmented" role="group" aria-label="정렬 기준">
          {([3, 5] as Horizon[]).map((h) => (
            <button key={h} className={horizon === h ? 'is-on' : ''} onClick={() => setHorizon(h)} aria-pressed={horizon === h}>
              {h}년 기준
            </button>
          ))}
        </div>
        <button className="btn" onClick={run} disabled={!!progress}>
          {progress ? `분석 중 ${progress.done}/${progress.total}` : '다시 분석'}
        </button>
        <span className="muted">{candidates.length}개 차종 대상</span>
      </div>

      {progress && rows.length === 0 && (
        <p className="notice">
          엔카에서 {progress.total}개 차종의 매물을 불러와 분석하는 중… ({progress.done}/{progress.total})
        </p>
      )}

      {rows.length > 0 && (
        <div className={progress ? 'is-refreshing' : undefined}>
          {picks.length === 0 && (
            <p className="notice">
              {minHp}마력 이상에서는 3년 잔존율 {formatPct(RECOMMEND_RETENTION3)} 이상인 차종이 없어, 상대적으로 가치를 잘 지키는 상위
              차종을 보여줍니다.
            </p>
          )}
          {shown.length > 0 && (
            <div className="pick-list">
              {shown.map((r, i) => (
                <button key={r.car.id} className="pick-card" onClick={() => onOpenMarket(r.car.id)}>
                  <span className="pick-card__rank">
                    {picks.length > 0 ? '추천' : '상위'} {i + 1}
                  </span>
                  <strong className="pick-card__name">{r.car.name}</strong>
                  <span className="pick-card__value">
                    {horizon}년 후 <strong>{formatPct(horizon === 3 ? r.dep!.retention3 : r.dep!.retention5)}</strong> 유지
                  </span>
                  <span className="muted">
                    {r.car.hp}마력 · {r.car.zeroTo100}초 · 시세 {r.medianPrice ? formatPrice(r.medianPrice) : '-'}
                  </span>
                  <GradeBadge grade={gradeOf(r.dep!.retention3)} />
                </button>
              ))}
            </div>
          )}

          {analyzed.length > 0 && (
            <section className="chart-card">
              <header>
                <h3>예상 잔존율 ({horizon}년 기준 정렬)</h3>
                <p className="muted">지금 시세를 100%로 볼 때 3년·5년 뒤 남는 가치. 100%를 넘으면 오히려 오르는 차</p>
              </header>
              <RetentionChart
                rows={analyzed.map((r) => ({ name: r.car.name, r3: r.dep!.retention3 * 100, r5: r.dep!.retention5 * 100 }))}
              />
            </section>
          )}

          <div className="section-title">
            <h2>전체 순위</h2>
            {savedNote && <span className="muted">{savedNote}</span>}
          </div>
          {narrow ? (
            <ol className="rank-list">
              {visible.map((r, i) => {
                const obs = observedFor(r.car.id);
                return (
                  <li key={r.car.id} className="rank-item">
                    <button className="rank-item__btn" onClick={() => onOpenMarket(r.car.id)}>
                      <div className="rank-item__head">
                        <span className="rank-item__rank num">{r.dep ? i + 1 : '-'}</span>
                        <strong className="rank-item__name">{r.car.name}</strong>
                        {r.dep && <GradeBadge grade={gradeOf(r.dep.retention3)} />}
                      </div>
                      {r.dep ? (
                        <dl className="rank-item__metrics">
                          <div>
                            <dt>3년 후</dt>
                            <dd className="num">{formatPct(r.dep.retention3)}</dd>
                          </div>
                          <div>
                            <dt>5년 후</dt>
                            <dd className="num">{formatPct(r.dep.retention5)}</dd>
                          </div>
                          <div>
                            <dt>연간</dt>
                            <dd className="num">{formatSignedPct((r.dep.annualFactor - 1) * 100)}</dd>
                          </div>
                          <div>
                            <dt>시세</dt>
                            <dd className="num">{r.medianPrice ? formatPrice(r.medianPrice) : '-'}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="muted rank-item__na">{r.error ? '불러오기 실패' : '매물이 적거나 연식 분포가 좁아 추정 불가'}</p>
                      )}
                      <div className="rank-item__foot muted">
                        {r.car.hp}마력 · {r.car.zeroTo100}초 · 매물 {r.count}대
                        {r.dep && (
                          <>
                            {' · '}
                            <ConfidenceTag confidence={r.dep.confidence} />
                            {r.dep.usedPeerFallback && ' · 유사 트림 포함'}
                          </>
                        )}
                        {obs && ` · 실측 ${obs.days}일 ${formatSignedPct(obs.changePct)}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>차종</th>
                    <th className="num">출력</th>
                    <th className="num">0-100</th>
                    <th className="num">매물</th>
                    <th className="num">시세 중앙값</th>
                    <th className="num">연간 변화</th>
                    <th className="num">3년 후</th>
                    <th className="num">5년 후</th>
                    <th>판정</th>
                    <th>실측 변동</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const obs = observedFor(r.car.id);
                    return (
                      <tr key={r.car.id}>
                        <td className="num">{r.dep ? i + 1 : '-'}</td>
                        <td>
                          <button className="link-btn" onClick={() => onOpenMarket(r.car.id)}>
                            {r.car.name}
                          </button>
                          {r.dep && (
                            <div className="cell-sub">
                              <ConfidenceTag confidence={r.dep.confidence} />
                              {r.dep.usedPeerFallback && ' · 유사 트림 포함'}
                            </div>
                          )}
                        </td>
                        <td className="num">{r.car.hp}</td>
                        <td className="num">{r.car.zeroTo100}초</td>
                        <td className="num">{r.count}</td>
                        <td className="num">{r.medianPrice ? formatPrice(r.medianPrice) : '-'}</td>
                        {r.dep ? (
                          <>
                            <td className="num">{formatSignedPct((r.dep.annualFactor - 1) * 100)}</td>
                            <td className="num">{formatPct(r.dep.retention3)}</td>
                            <td className="num">{formatPct(r.dep.retention5)}</td>
                            <td>
                              <GradeBadge grade={gradeOf(r.dep.retention3)} />
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="muted">
                            {r.error ? '불러오기 실패' : '매물이 적거나 연식 분포가 좁아 추정 불가'}
                          </td>
                        )}
                        <td className="muted">{obs ? `${obs.days}일 ${formatSignedPct(obs.changePct)}` : '기록 쌓는 중'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted footnote">
            ※ 현재 매물 시세의 횡단면 추정이므로 세대 변경·단종·환율 같은 시장 변화는 반영되지 않습니다. 신뢰도 '낮음'은 매물 수가 적거나
            연식 폭이 좁은 경우입니다.
          </p>
        </div>
      )}
    </div>
  );
}

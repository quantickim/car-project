import { useMemo, useState } from 'react';
import { IS_STATIC } from '../api/client';
import { CarSelect } from '../components/CarSelect';
import { HistoryChart } from '../components/charts/HistoryChart';
import { MileageScatter } from '../components/charts/MileageScatter';
import { YearPriceChart } from '../components/charts/YearPriceChart';
import { ConfidenceTag, GradeBadge } from '../components/GradeBadge';
import { StatTile } from '../components/StatTile';
import type { CatalogCar } from '../data/catalog';
import { useCarListings } from '../hooks/useCarListings';
import type { usePriceHistory } from '../hooks/usePriceHistory';
import { analyzeCar, gradeOf, priceByFormYear } from '../lib/analysis';
import { formatPct, formatPrice, formatSignedPct } from '../lib/format';
import { makeSnapshot, observedChange } from '../lib/history';
import { median } from '../lib/stats';

interface Props {
  catalog: CatalogCar[];
  carId: string;
  onCarChange: (id: string) => void;
  history: ReturnType<typeof usePriceHistory>;
}

export function MarketPage({ catalog, carId, onCarChange, history }: Props) {
  const car = catalog.find((c) => c.id === carId) ?? catalog[0];
  const { loading, error, listings, modelListings } = useCarListings(car);
  const [showTable, setShowTable] = useState(false);
  const [saving, setSaving] = useState<string>();

  const byYear = useMemo(() => priceByFormYear(listings), [listings]);
  const dep = useMemo(() => analyzeCar(car, modelListings), [car, modelListings]);
  const carHistory = useMemo(() => history.snapshots.filter((s) => s.carId === car.id), [history.snapshots, car.id]);
  const observed = observedChange(carHistory);
  const target = car.targetYear ? byYear.find((y) => y.year === car.targetYear) : undefined;

  async function recordToday() {
    const snap = makeSnapshot(car.id, listings);
    if (!snap) return;
    setSaving('저장 중…');
    try {
      await history.save([snap]);
      setSaving('오늘 시세를 기록했습니다');
    } catch (e) {
      setSaving(String(e));
    }
  }

  return (
    <div className="market-page">
      <div className="toolbar">
        <CarSelect catalog={catalog} value={car.id} onChange={onCarChange} />
      </div>

      <section className="car-spec">
        <h2>{car.name}</h2>
        <p className="car-spec__desc">{car.description}</p>
        <dl className="car-spec__grid">
          <div>
            <dt>최고출력</dt>
            <dd>{car.hp}마력</dd>
          </div>
          <div>
            <dt>0-100 / 0-200</dt>
            <dd>
              {car.zeroTo100}초{car.zeroTo200 ? ` / ${car.zeroTo200}초` : ''}
            </dd>
          </div>
          <div>
            <dt>최고속도</dt>
            <dd>{car.topSpeed}</dd>
          </div>
          <div>
            <dt>서스펜션</dt>
            <dd>{car.suspension}</dd>
          </div>
          <div>
            <dt>전장 / 전폭</dt>
            <dd>
              {car.lengthMm.toLocaleString()} / {car.widthMm.toLocaleString()} mm
            </dd>
          </div>
          <div>
            <dt>엔카 분류</dt>
            <dd>
              {car.encar.model}
              {car.badges?.length ? ` · ${car.badges.join(', ')}` : ''}
            </dd>
          </div>
        </dl>
        {car.note && <p className="muted">※ {car.note}</p>}
      </section>

      {error && <p className="notice notice--error">엔카 데이터를 불러오지 못했습니다: {error}</p>}
      {loading && listings.length === 0 && <p className="notice">엔카에서 매물을 불러오는 중…</p>}

      {!loading && !error && listings.length === 0 && <p className="notice">현재 엔카에 등록된 매물이 없습니다.</p>}

      {listings.length > 0 && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <div className="stat-row">
            <StatTile label="현재 매물" value={`${listings.length}대`} sub={`연식 ${byYear[0].year}~${byYear[byYear.length - 1].year}`} />
            <StatTile label="시세 중앙값" value={`${formatPrice(median(listings.map((l) => l.Price)))}원`} sub="전 연식" />
            {target && (
              <StatTile label={`${car.targetYear}년식 시세`} value={`${formatPrice(target.median)}원`} sub={`${target.count}대 · ${formatPrice(target.p25)}~${formatPrice(target.p75)}`} />
            )}
            {dep ? (
              <>
                <StatTile label="연간 가치 변화" value={formatSignedPct((dep.annualFactor - 1) * 100)} sub={<GradeBadge grade={gradeOf(dep.retention3)} />} />
                <StatTile
                  label="예상 잔존율 3년 / 5년"
                  value={`${formatPct(dep.retention3)} / ${formatPct(dep.retention5)}`}
                  sub={
                    <>
                      <ConfidenceTag confidence={dep.confidence} /> · {dep.n}대{dep.usedPeerFallback ? ' · 유사 트림 포함' : ''}
                    </>
                  }
                />
              </>
            ) : (
              <StatTile label="예상 잔존율" value="-" sub="연식 분포가 좁거나 매물이 적어 추정 불가" />
            )}
          </div>

          <div className="chart-grid">
            <section className="chart-card">
              <header>
                <h3>연식별 시세</h3>
                <p className="muted">선: 중앙값 · 띠: 가격 중간 50% 구간 (만원)</p>
              </header>
              <YearPriceChart data={byYear} targetYear={car.targetYear} />
              <button className="btn btn--small" onClick={() => setShowTable((v) => !v)}>
                {showTable ? '표 닫기' : '표로 보기'}
              </button>
              {showTable && (
                <div className="table-wrap chart-card__table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>연식</th>
                        <th className="num">매물</th>
                        <th className="num">중앙값</th>
                        <th className="num">하위 25%</th>
                        <th className="num">상위 25%</th>
                        <th className="num">최저</th>
                        <th className="num">최고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byYear.map((y) => (
                        <tr key={y.year}>
                          <td>{y.year}</td>
                          <td className="num">{y.count}</td>
                          <td className="num">{formatPrice(y.median)}</td>
                          <td className="num">{formatPrice(y.p25)}</td>
                          <td className="num">{formatPrice(y.p75)}</td>
                          <td className="num">{formatPrice(y.min)}</td>
                          <td className="num">{formatPrice(y.max)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="chart-card">
              <header>
                <h3>주행거리별 가격</h3>
                <p className="muted">점 하나가 매물 한 대 (만원)</p>
              </header>
              <MileageScatter listings={listings} targetYear={car.targetYear} />
            </section>

            <section className="chart-card chart-card--wide">
              <header>
                <h3>시세 추이 (기록)</h3>
                <p className="muted">
                  같은 연식 매물의 중앙값을 날짜별로 추적합니다.
                  {observed && ` ${observed.days}일간 실측 변동 ${formatSignedPct(observed.changePct)}`}
                </p>
              </header>
              {carHistory.length > 0 ? (
                <HistoryChart snapshots={carHistory} />
              ) : (
                <p className="notice">
                  {IS_STATIC
                    ? '아직 기록된 시세가 없습니다. 매일 오전 9시에 자동으로 기록됩니다.'
                    : '아직 기록된 시세가 없습니다. 아래 버튼이나 `npm run snapshot`으로 매일 기록하면 추이가 그려집니다.'}
                </p>
              )}
              {carHistory.length === 1 && <p className="muted">기록이 하루치뿐이라 점 하나만 보입니다. 날짜가 쌓이면 선으로 이어집니다.</p>}
              {IS_STATIC ? (
                <p className="muted chart-card__actions">매일 오전 9시(KST)에 GitHub Actions가 시세를 수집·기록합니다.</p>
              ) : (
                <div className="chart-card__actions">
                  <button className="btn btn--small" onClick={recordToday} disabled={!history.available}>
                    오늘 시세 기록
                  </button>
                  {saving && <span className="muted">{saving}</span>}
                  {!history.available && <span className="muted">기록 저장은 `npm run dev` 서버에서만 가능합니다</span>}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

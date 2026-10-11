import { useEffect, useState } from 'react';
import { encar, IS_STATIC } from '../api/client';
import type { EncarPath, Facet } from '../api/types';
import type { CatalogCar } from '../data/catalog';

interface Props {
  catalog: CatalogCar[];
  onAdd: (car: CatalogCar) => void;
  onRemove: (id: string) => void;
  onOpenMarket: (carId: string) => void;
}

type Level = 'manufacturer' | 'modelGroup' | 'model' | 'badgeGroup';
const LEVELS: Level[] = ['manufacturer', 'modelGroup', 'model', 'badgeGroup'];
const LEVEL_LABEL: Record<Level, string> = { manufacturer: '제조사', modelGroup: '모델', model: '세대', badgeGroup: '연료/구동' };

/** 선택한 단계까지의 경로로 다음 단계 후보를 엔카에서 받아온다 */
function useFacets(path: Partial<EncarPath> & { carType: 'N' | 'Y' }, enabled: boolean) {
  const [facets, setFacets] = useState<Facet[]>([]);
  const key = JSON.stringify(path);
  useEffect(() => {
    if (!enabled || IS_STATIC) return setFacets([]);
    let alive = true;
    encar
      .fetchFacets(path)
      .then((r) => alive && setFacets(r.facets))
      .catch(() => alive && setFacets([]));
    return () => {
      alive = false;
    };
    // path 는 key 로 비교
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return facets;
}

export function CatalogPage({ catalog, onAdd, onRemove, onOpenMarket }: Props) {
  const [carType, setCarType] = useState<'N' | 'Y'>('N');
  const [path, setPath] = useState<Partial<Record<Level, string>>>({});
  const [badges, setBadges] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', hp: '', zeroTo100: '', targetYear: '', topSpeed: '', description: '' });

  const pick = (level: Level, value: string) => {
    const idx = LEVELS.indexOf(level);
    const next: Partial<Record<Level, string>> = {};
    LEVELS.slice(0, idx).forEach((l) => (next[l] = path[l]));
    if (value) next[level] = value;
    setPath(next);
    setBadges([]);
  };

  const options: Record<Level, Facet[]> = {
    manufacturer: useFacets({ carType }, true),
    modelGroup: useFacets({ carType, manufacturer: path.manufacturer }, !!path.manufacturer),
    model: useFacets({ carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup }, !!path.modelGroup),
    badgeGroup: useFacets({ carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup, model: path.model }, !!path.model),
  };
  const badgeOptions = useFacets(
    { carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup, model: path.model, badgeGroup: path.badgeGroup },
    !!path.badgeGroup,
  );

  const ready = !!(path.manufacturer && path.modelGroup && path.model) && form.hp !== '';
  const autoName = [path.manufacturer, path.model, badges[0]].filter(Boolean).join(' ');

  function submit() {
    if (!ready) return;
    onAdd({
      id: `custom-${Date.now()}`,
      name: form.name.trim() || autoName,
      hp: Number(form.hp),
      zeroTo100: Number(form.zeroTo100) || 0,
      topSpeed: form.topSpeed || '-',
      suspension: '-',
      lengthMm: 0,
      widthMm: 0,
      description: form.description,
      targetYear: Number(form.targetYear) || undefined,
      encar: { carType, manufacturer: path.manufacturer!, modelGroup: path.modelGroup!, model: path.model!, badgeGroup: path.badgeGroup },
      badges: badges.length ? badges : undefined,
    });
    setPath({});
    setBadges([]);
    setForm({ name: '', hp: '', zeroTo100: '', targetYear: '', topSpeed: '', description: '' });
  }

  return (
    <div className="catalog-page">
      {IS_STATIC ? (
        <p className="notice">
          차종 추가는 엔카를 실시간 조회해야 해서 로컬 서버(`npm run dev`)에서만 됩니다. 배포판 차종을 바꾸려면 src/data/catalog.ts 를
          수정해 푸시하세요.
        </p>
      ) : (
        <section className="add-car">
          <h2>차종 추가</h2>
          <p className="muted">엔카 분류를 차례로 고르면 그 차종의 매물로 검색·시세·추천 분석을 합니다.</p>
          <div className="add-car__grid">
            <label className="field">
              구분
              <select
                value={carType}
                onChange={(e) => {
                  setCarType(e.target.value as 'N' | 'Y');
                  setPath({});
                  setBadges([]);
                }}
              >
                <option value="N">수입</option>
                <option value="Y">국산</option>
              </select>
            </label>
            {LEVELS.map((level, i) => {
              const enabled = i === 0 || !!path[LEVELS[i - 1]];
              return (
                <label className="field" key={level}>
                  {LEVEL_LABEL[level]}
                  {level === 'badgeGroup' && <span className="muted"> (선택)</span>}
                  <select value={path[level] ?? ''} disabled={!enabled} onChange={(e) => pick(level, e.target.value)}>
                    <option value="">선택</option>
                    {options[level].map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.value} ({f.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>

          {badgeOptions.length > 0 && (
            <div className="add-car__badges">
              <span className="muted">트림 (여러 개 선택 가능, 선택하지 않으면 전체)</span>
              <div className="chips">
                {badgeOptions.map((f) => {
                  const on = badges.includes(f.value);
                  return (
                    <button
                      key={f.value}
                      className={`chip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setBadges(on ? badges.filter((b) => b !== f.value) : [...badges, f.value])}
                    >
                      {f.value}
                      <span className="chip__meta">{f.count}대</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="add-car__grid">
            <label className="field">
              이름
              <input placeholder={autoName || '자동 생성'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              최고출력 (마력) *
              <input inputMode="numeric" value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} />
            </label>
            <label className="field">
              0-100 (초)
              <input inputMode="decimal" value={form.zeroTo100} onChange={(e) => setForm({ ...form, zeroTo100: e.target.value })} />
            </label>
            <label className="field">
              관심 연식
              <input
                inputMode="numeric"
                placeholder="예: 2019"
                value={form.targetYear}
                onChange={(e) => setForm({ ...form, targetYear: e.target.value })}
              />
            </label>
            <label className="field">
              최고 속도
              <input
                placeholder="예: 250 km/h (제한)"
                value={form.topSpeed}
                onChange={(e) => setForm({ ...form, topSpeed: e.target.value })}
              />
            </label>
            <label className="field add-car__desc">
              특징 메모
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          <button className="btn btn--primary" disabled={!ready} onClick={submit}>
            카탈로그에 추가
          </button>
        </section>
      )}

      <div className="section-title">
        <h2>관심 차종 {catalog.length}개</h2>
        <span className="muted">기본 목록은 test.txt 기준 (src/data/catalog.ts)</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>차종</th>
              <th className="num">출력</th>
              <th className="num">0-100 / 0-200</th>
              <th>최고 속도</th>
              <th>서스펜션</th>
              <th>엔카 분류</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {catalog.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="link-btn" onClick={() => onOpenMarket(c.id)}>
                    {c.name}
                  </button>
                  {c.targetYear && <span className="muted"> [{String(c.targetYear).slice(2)}년식]</span>}
                </td>
                <td className="num">{c.hp}마력</td>
                <td className="num">
                  {c.zeroTo100 || '-'}초{c.zeroTo200 ? ` / ${c.zeroTo200}초` : ''}
                </td>
                <td>{c.topSpeed}</td>
                <td className="cell-wrap">{c.suspension}</td>
                <td className="muted cell-wrap">
                  {c.encar.model}
                  {c.badges?.length ? ` · ${c.badges.join(', ')}` : c.encar.badgeGroup ? ` · ${c.encar.badgeGroup}` : ''}
                </td>
                <td>
                  {c.custom && (
                    <button className="btn btn--small" onClick={() => onRemove(c.id)}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

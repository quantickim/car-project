import { useEffect, useState } from 'react';
import { encar } from '../api/client';
import type { EncarPath, Facet } from '../api/types';
import type { CatalogCar } from '../data/catalog';
import { resolveCarInfo } from '../lib/autoSpec';

interface Props {
  catalog: CatalogCar[];
  onAdd: (car: CatalogCar) => void;
  onUpdate: (id: string, patch: Partial<CatalogCar>) => void;
  onRemove: (id: string) => void;
  onOpenMarket: (carId: string) => void;
}

type Level = 'manufacturer' | 'modelGroup' | 'model' | 'badgeGroup';
const LEVELS: Level[] = ['manufacturer', 'modelGroup', 'model', 'badgeGroup'];
const LEVEL_LABEL: Record<Level, string> = { manufacturer: '제조사', modelGroup: '모델', model: '세대', badgeGroup: '연료/구동' };
const ALL_TRIMS = '*';

/** 선택한 단계까지의 경로로 다음 단계 후보를 엔카에서 받아온다 */
function useFacets(path: Partial<EncarPath> & { carType: 'N' | 'Y' }, enabled: boolean) {
  const [facets, setFacets] = useState<Facet[]>([]);
  const key = JSON.stringify(path);
  useEffect(() => {
    if (!enabled) return setFacets([]);
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

const sameCar = (c: CatalogCar, path: EncarPath, badges?: string[]) =>
  c.encar.manufacturer === path.manufacturer &&
  c.encar.model === path.model &&
  (c.encar.badgeGroup ?? '') === (path.badgeGroup ?? '') &&
  (c.badges ?? []).join('|') === (badges ?? []).join('|');

export function CatalogPage({ catalog, onAdd, onUpdate, onRemove, onOpenMarket }: Props) {
  const [carType, setCarType] = useState<'N' | 'Y'>('N');
  const [path, setPath] = useState<Partial<Record<Level, string>>>({});
  const [notice, setNotice] = useState<string>();
  // 직접 추가한 차종(최근 순)을 위에
  const ordered = [...catalog.filter((c) => c.custom).reverse(), ...catalog.filter((c) => !c.custom)];

  const pick = (level: Level, value: string) => {
    const idx = LEVELS.indexOf(level);
    const next: Partial<Record<Level, string>> = {};
    LEVELS.slice(0, idx).forEach((l) => (next[l] = path[l]));
    if (value) next[level] = value;
    setPath(next);
    setNotice(undefined);
  };

  const options: Record<Level, Facet[]> = {
    manufacturer: useFacets({ carType }, true),
    modelGroup: useFacets({ carType, manufacturer: path.manufacturer }, !!path.manufacturer),
    model: useFacets({ carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup }, !!path.modelGroup),
    badgeGroup: useFacets({ carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup, model: path.model }, !!path.model),
  };
  const trims = useFacets(
    { carType, manufacturer: path.manufacturer, modelGroup: path.modelGroup, model: path.model, badgeGroup: path.badgeGroup },
    !!path.badgeGroup,
  );

  /** 제원 자동 조회 (실패해도 차종은 남겨 두고 '다시 조회'로 재시도) */
  function fillInfo(car: CatalogCar) {
    onUpdate(car.id, { specStatus: 'loading' });
    resolveCarInfo(car.encar, car.badges)
      .then((info) => onUpdate(car.id, info))
      .catch((e: unknown) =>
        onUpdate(car.id, { specStatus: 'failed', description: e instanceof Error ? e.message : '정보를 찾지 못했습니다' }),
      );
  }

  /** 트림을 고르면 바로 추가하고, 나머지 정보는 자동으로 채운다 */
  function addTrim(trim: string) {
    if (!trim || !path.manufacturer || !path.modelGroup || !path.model || !path.badgeGroup) return;
    const encarPath: EncarPath = {
      carType,
      manufacturer: path.manufacturer,
      modelGroup: path.modelGroup,
      model: path.model,
      badgeGroup: path.badgeGroup,
    };
    const badges = trim === ALL_TRIMS ? undefined : [trim];
    if (catalog.some((c) => sameCar(c, encarPath, badges))) return setNotice('이미 추가된 차종입니다');

    const car: CatalogCar = {
      id: `custom-${Date.now()}`,
      name: [path.manufacturer, path.model, trim === ALL_TRIMS ? path.badgeGroup : trim].join(' '),
      hp: 0,
      zeroTo100: 0,
      topSpeed: '-',
      suspension: '-',
      lengthMm: 0,
      widthMm: 0,
      description: '',
      encar: encarPath,
      badges,
      specStatus: 'loading',
    };
    onAdd(car);
    fillInfo(car);
    setNotice(`'${car.name}' 추가됨 — 제원을 자동으로 찾는 중입니다`);
  }

  return (
    <div className="catalog-page">
      <section className="add-car">
        <h2>차종 추가</h2>
        <p className="muted">
          트림까지 고르면 바로 추가됩니다. 마력·제로백·최고속도는 auto-data.net, 신차가와 관심 연식은 엔카 매물에서 자동으로 채웁니다.
        </p>
        <div className="add-car__grid">
          <label className="field">
            구분
            <select
              value={carType}
              onChange={(e) => {
                setCarType(e.target.value as 'N' | 'Y');
                setPath({});
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
          <label className="field">
            트림
            <select value="" disabled={!path.badgeGroup} onChange={(e) => addTrim(e.target.value)}>
              <option value="">선택하면 추가</option>
              {trims.length > 1 && <option value={ALL_TRIMS}>전체 트림 ({path.badgeGroup})</option>}
              {trims.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.value} ({f.count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
        </div>
        {notice && <p className="notice add-car__notice">{notice}</p>}
      </section>

      <div className="section-title">
        <h2>관심 차종 {catalog.length}개</h2>
        <span className="muted">기본 목록은 test.txt 기준</span>
      </div>
      <ul className="catalog-list">
        {ordered.map((c) => (
          <li key={c.id} className="catalog-item">
            <div className="catalog-item__head">
              <button className="link-btn" onClick={() => onOpenMarket(c.id)}>
                {c.name}
              </button>
              {c.targetYear && <span className="muted">[{String(c.targetYear).slice(2)}년식]</span>}
              {c.custom && (
                <button className="btn btn--small catalog-item__remove" onClick={() => onRemove(c.id)}>
                  삭제
                </button>
              )}
            </div>
            {c.specStatus === 'loading' ? (
              <p className="muted catalog-item__specs">제원 자동 조회 중…</p>
            ) : (
              <p className="catalog-item__specs">
                {c.hp ? `${c.hp}마력` : '마력 미상'} · 0-100 {c.zeroTo100 ? `${c.zeroTo100}초` : '-'}
                {c.zeroTo200 ? ` / 0-200 ${c.zeroTo200}초` : ''} · 최고 {c.topSpeed}
                {c.originPrice ? ` · 신차가 ${c.originPrice.toLocaleString()}만원` : ''}
              </p>
            )}
            <p className="muted catalog-item__meta">
              엔카: {c.encar.model}
              {c.badges?.length ? ` · ${c.badges.join(', ')}` : c.encar.badgeGroup ? ` · ${c.encar.badgeGroup}` : ''}
              {c.specSource && (
                <>
                  {' · '}
                  <a href={c.specSource.url} target="_blank" rel="noreferrer">
                    제원 출처
                  </a>
                </>
              )}
            </p>
            {c.custom && c.specStatus === 'failed' && (
              <p className="catalog-item__failed">
                <span className="muted">{c.description || '제원을 찾지 못했습니다'}</span>
                <button className="btn btn--small" onClick={() => fillInfo(c)}>
                  다시 조회
                </button>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

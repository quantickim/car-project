/**
 * auto-data.net 에서 트림 제원(마력·제로백·최고속도·전장/전폭)을 자동으로 찾는다.
 *
 * 브라우저에서 auto-data.net 을 직접 읽을 수 없어서(CORS) r.jina.ai 리더를 거친다.
 * 경로: 전체 브랜드 → 브랜드의 모델 → 모델의 세대 → 세대의 트림(모디피케이션) 순으로 내려가며
 * 엔카 상세 API의 영문 차명(제조사·모델그룹·트림), 세대 코드(예: "RS5 (F5)" 의 F5), 차체(쿠페·스포트백 등),
 * 매물 연식 범위를 점수로 매겨 가장 잘 맞는 것을 고른다.
 */

export interface SpecQuery {
  manufacturerEn: string; // "Audi"
  modelGroupEn: string; // "RS5"
  /** 엔카 세대명 (예: "RS5 (F5)", "8시리즈 (G15)") */
  modelKo: string;
  gradeEn: string; // "2.9 TFSI Quattro"
  /** 엔카 트림명 (차체 힌트: 쿠페·스포트백·카브리올레·그란쿠페 등) */
  badgeKo: string;
  /** 매물의 모델연식 범위 */
  yearFrom: number;
  yearTo: number;
  /** 매물이 가장 많은 모델연식 (페이스리프트 전후 구분용) */
  yearMode: number;
  /** 엔카 연료명 (가솔린·디젤·전기·가솔린+전기 등) */
  fuelKo: string;
}

export interface SpecResult {
  hp: number;
  zeroTo100?: number;
  topSpeedKmh?: number;
  lengthMm?: number;
  widthMm?: number;
  /** auto-data 의 트림 이름 (확인용) */
  matchedName: string;
  url: string;
}

export type FetchText = (url: string) => Promise<string>;

const BASE = 'https://www.auto-data.net/en/';

interface Link {
  url: string;
  title: string;
  /** 링크 앞쪽 텍스트 (마력·연도 등이 들어 있음) */
  text: string;
}

/** Jina 마크다운에서 auto-data 링크와 링크 텍스트를 뽑는다 */
function parseLinks(md: string, kind: RegExp): Link[] {
  const re = /\]\((https:\/\/www\.auto-data\.net\/en\/[^\s)]+)\s+"([^"]*)"\)/g;
  const out: Link[] = [];
  let prev = 0;
  for (let m = re.exec(md); m; m = re.exec(md)) {
    if (kind.test(m[1])) out.push({ url: m[1], title: m[2].replace(/ - Technical Specs.*$/, ''), text: md.slice(prev, m.index) });
    prev = m.index + m[0].length;
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.+]/g, '');
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9.+]+/).filter(Boolean));
/** 모델그룹 비교용: "S-Class" / "s-class" → "s", "8-Series" → "8series" */
const modelKey = (s: string) => norm(s.replace(/-?class$/i, '').replace(/-class-?/i, ''));

/** 엔카 한글 트림·세대명에서 차체 키워드 (auto-data 영문 표기) */
function bodyHints(ko: string): string[] {
  const hints: [RegExp, string][] = [
    [/그란\s?쿠페/, 'gran coupe'],
    [/스포트백|스포츠백/, 'sportback'],
    [/카브리올레|컨버터블|로드스터/, 'cabrio'],
    [/아반트/, 'avant'],
    [/쿠페/, 'coupe'],
    [/LWB|Li\b/, 'long'],
    [/박스터/, 'boxster'],
    [/카이맨/, 'cayman'],
    [/스파이더/, 'spyder'],
    [/타르가/, 'targa'],
    [/그란투리스모/, 'gran turismo'],
  ];
  const found = hints.filter(([re]) => re.test(ko)).map(([, h]) => h);
  // "그란쿠페" 는 일반 쿠페가 아님
  return found.includes('gran coupe') ? found.filter((h) => h !== 'coupe') : found;
}

/** "RS5 (F5)" → "f5", "S-클래스 W222" → "w222", "CLE-클래스 C236" → "c236" */
function generationCode(modelKo: string): string | undefined {
  const paren = modelKo.match(/\(([A-Za-z0-9]+)\)/);
  if (paren) return paren[1].toLowerCase();
  const code = modelKo.match(/\b([A-Z]{1,2}\d{2,3})\b/);
  return code?.[1].toLowerCase();
}

function yearsIn(text: string): [number, number] | undefined {
  const m = text.match(/((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})?/);
  if (!m) return undefined;
  return [Number(m[1]), m[2] ? Number(m[2]) : new Date().getFullYear()];
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];

export async function lookupSpec(q: SpecQuery, fetchText: FetchText): Promise<SpecResult | null> {
  const want: [number, number] = [q.yearFrom, q.yearTo];

  // 1. 브랜드
  const brands = parseLinks(await fetchText(`${BASE}allbrands`), /-brand-\d+$/);
  const brand = brands.find((b) => norm(b.title) === norm(q.manufacturerEn));
  if (!brand) return null;

  // 2. 모델: 슬러그에서 브랜드 접두어를 뗀 이름이 엔카 영문 모델그룹과 같은 것
  const brandSlug = brand.url.replace(BASE, '').replace(/-brand-\d+$/, '');
  const models = parseLinks(await fetchText(brand.url), /-model-\d+$/);
  const target = modelKey(q.modelGroupEn);
  const scoredModels = models
    .map((m) => {
      const name = modelKey(m.url.replace(BASE, '').replace(/-model-\d+$/, '').replace(`${brandSlug}-`, ''));
      const score = name === target ? 3 : name.startsWith(target) || target.startsWith(name) ? 1 : 0;
      return { m, score, len: name.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.len - b.len);
  const model = scoredModels[0]?.m;
  if (!model) return null;

  // 3. 세대: 세대 코드·차체 일치와 연식 겹침으로 상위 4개를 골라 트림 목록을 본다
  const code = generationCode(q.modelKo);
  const hints = bodyHints(`${q.badgeKo} ${q.modelKo}`);
  const gens = parseLinks(await fetchText(model.url), /-generation-\d+$/)
    .map((g) => {
      const t = g.title.toLowerCase();
      let score = 0;
      if (code && new RegExp(`\\b${code}\\b`).test(t)) score += 3;
      for (const h of hints) if (t.includes(h)) score += 2;
      for (const v of BODY_VARIANTS) if (t.includes(v) && !hints.some((h) => v.startsWith(h) || h.startsWith(v))) score -= 2;
      const ys = yearsIn(g.text);
      if (ys && overlaps(ys, want)) score += 1;
      const dims = g.text.match(/Dimensions\s+(\d{4})\s*×\s*(\d{4})/);
      return { g, score, dims };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // 4. 트림: 엔진 토큰·연식 겹침
  const tokens = [...words(q.gradeEn)].filter((t) => !TRIM_PACKAGES.includes(t));
  const wanted = `${q.badgeKo} ${q.gradeEn}`.toLowerCase();
  const wantsUpper = /퍼포먼스|플러스|performance|competition|plus/.test(wanted);
  const isDiesel = /디젤/.test(q.fuelKo);
  const isElectric = q.fuelKo === '전기';

  let best: { score: number; result: SpecResult } | null = null;
  for (const { g, score: genScore, dims } of gens) {
    const mods = parseLinks(await fetchText(g.url), /-\d+$/).filter((l) => /\(\d+\s*Hp\)/.test(l.title));
    for (const mod of mods) {
      const title = words(mod.title);
      const squashed = norm(mod.title);
      let score = genScore;
      // 숫자가 든 토큰(2.9, m850i, cle53 등)이 맞으면 크게 가산. 띄어쓰기 차이("CLE 53")도 허용
      for (const t of tokens) if (title.has(t) || (/\d/.test(t) && squashed.includes(t))) score += /\d/.test(t) ? 3 : 1;
      const ys = yearsIn(mod.text);
      if (ys) {
        score += overlaps(ys, want) ? 2 : -3;
        if (q.yearMode >= ys[0] && q.yearMode <= ys[1]) score += 2;
      }
      if (/performance|competition|\bplus\b/.test(mod.title.toLowerCase()) !== wantsUpper) score -= 2;
      const lower = mod.title.toLowerCase();
      if (/\d+\s?d\b|tdi|diesel|bluetec|crdi/.test(lower) !== isDiesel) score -= 3;
      if (/kwh|electric/.test(lower) !== isElectric) score -= 3;
      const hp = Number(mod.title.match(/\((\d+)\s*Hp\)/)?.[1]);
      if (!hp) continue;
      if (!best || score > best.score) {
        best = {
          score,
          result: {
            hp,
            zeroTo100: num(mod.text.match(/0-100 km\/h\s+([\d.]+)\s*sec/)?.[1]),
            topSpeedKmh: num(mod.text.match(/Maximum speed\s+(\d+)\s*km\/h/)?.[1]),
            lengthMm: num(dims?.[1]),
            widthMm: num(dims?.[2]),
            matchedName: mod.title,
            url: mod.url,
          },
        };
      }
    }
  }
  return best?.result ?? null;
}

const num = (s?: string) => (s ? Number(s) : undefined);

/** 성능과 무관한 트림 패키지명 (매칭 토큰에서 제외) */
const TRIM_PACKAGES = ['premium', 'sport', 'dynamic', 'line', 'edition', 'first', 'excellence', 'design', 'pure', 'm', 'amg', 'ipreformance'];

/** 엔카 트림에 언급이 없으면 피해야 하는 차체 변형 */
const BODY_VARIANTS = ['allroad', 'avant', 'touring', 'wagon', 'estate', 'shooting brake', 'cabrio', 'convertible', 'roadster', 'targa', 'speedster', 'long', 'gran coupe', 'sportback', 'coupe'];

/** r.jina.ai 리더로 auto-data 페이지를 읽는다 (CORS 허용). 같은 페이지는 저장소에 보관해 재사용 */
export function jinaFetcher(storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void }): FetchText {
  const mem = new Map<string, Promise<string>>();
  return (url) => {
    const key = `spec:${url}`;
    const hit = mem.get(key);
    if (hit) return hit;
    try {
      const stored = storage?.getItem(key);
      if (stored) return Promise.resolve(stored);
    } catch {
      /* 저장소 사용 불가 */
    }
    const p = fetch(`https://r.jina.ai/${url}`).then(async (r) => {
      if (!r.ok) throw new Error(`제원 사이트 응답 오류 ${r.status}`);
      const text = await r.text();
      try {
        storage?.setItem(key, text);
      } catch {
        /* 용량 초과는 무시 */
      }
      return text;
    });
    mem.set(key, p);
    p.catch(() => mem.delete(key));
    return p;
  };
}

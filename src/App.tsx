import { useEffect, useState } from 'react';
import { dataGeneratedAt, IS_STATIC } from './api/client';
import { useCatalog } from './hooks/useCatalog';
import { useFavorites } from './hooks/useFavorites';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePriceHistory } from './hooks/usePriceHistory';
import { CatalogPage } from './pages/CatalogPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { MarketPage } from './pages/MarketPage';
import { RecommendPage } from './pages/RecommendPage';
import { SearchPage } from './pages/SearchPage';

type Tab = 'search' | 'favorites' | 'market' | 'recommend' | 'catalog';
type Theme = 'system' | 'light' | 'dark';

const TABS: { id: Tab; label: string; short: string; icon: string }[] = [
  { id: 'recommend', label: '가치방어 추천', short: '추천', icon: '★' },
  { id: 'search', label: '매물 검색', short: '검색', icon: '⌕' },
  { id: 'favorites', label: '찜 목록', short: '찜', icon: '♥' },
  { id: 'market', label: '시세 분석', short: '시세', icon: '↗' },
  { id: 'catalog', label: '차종 관리', short: '차종', icon: '☰' },
];

const THEME_LABEL: Record<Theme, string> = { system: '◐ 자동', light: '☀ 라이트', dark: '☾ 다크' };

export default function App() {
  const [tab, setTab] = useLocalStorage<Tab>('car:tab', 'recommend');
  const [theme, setTheme] = useLocalStorage<Theme>('car:theme', 'system');
  const { catalog, addCar, removeCar, updateCar } = useCatalog();
  const favorites = useFavorites();
  const history = usePriceHistory();
  const [marketCarId, setMarketCarId] = useLocalStorage('car:market-car', catalog[0].id);
  const [generatedAt, setGeneratedAt] = useState<string>();

  useEffect(() => {
    dataGeneratedAt()?.then(setGeneratedAt).catch(() => {});
  }, []);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const selectTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const openMarket = (carId: string) => {
    setMarketCarId(carId);
    selectTab('market');
  };

  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

  return (
    <>
      <header className="app-header">
        <div className="container app-header__inner">
          <h1 className="app-header__title">
            중고차 시세 분석
            <span className="muted">
              {IS_STATIC
                ? generatedAt
                  ? `엔카 ${new Date(generatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 기준`
                  : '엔카 매일 수집'
                : '엔카 실시간'}
            </span>
          </h1>
          <button className="btn btn--small" onClick={() => setTheme(nextTheme[theme])} title="테마 전환">
            {THEME_LABEL[theme]}
          </button>
        </div>
        {/* PC: 상단 탭, 모바일: 하단 탭바 (같은 버튼을 CSS 로 배치만 바꿈) */}
        <nav className="tabs" aria-label="메뉴">
          <div className="container tabs__inner">
            {TABS.map((t) => (
              <button key={t.id} className={`tabs__item${tab === t.id ? ' is-active' : ''}`} onClick={() => selectTab(t.id)} aria-current={tab === t.id}>
                <span className="tabs__icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="tabs__label">{t.label}</span>
                <span className="tabs__short">{t.short}</span>
                {t.id === 'favorites' && favorites.favorites.length > 0 && <span className="tabs__count">{favorites.favorites.length}</span>}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="container app-main">
        {tab === 'recommend' && <RecommendPage catalog={catalog} history={history} onOpenMarket={openMarket} />}
        {tab === 'search' && <SearchPage catalog={catalog} favorites={favorites} />}
        {tab === 'favorites' && <FavoritesPage favorites={favorites} />}
        {tab === 'market' && <MarketPage catalog={catalog} carId={marketCarId} onCarChange={setMarketCarId} history={history} />}
        {tab === 'catalog' && <CatalogPage catalog={catalog} onAdd={addCar} onUpdate={updateCar} onRemove={removeCar} onOpenMarket={openMarket} />}
      </main>
    </>
  );
}

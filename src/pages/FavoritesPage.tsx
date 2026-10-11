import { ListingCard } from '../components/ListingCard';
import type { useFavorites } from '../hooks/useFavorites';
import { formatPrice } from '../lib/format';

export function FavoritesPage({ favorites }: { favorites: ReturnType<typeof useFavorites> }) {
  const list = favorites.favorites;
  if (list.length === 0) {
    return <p className="notice">아직 찜한 매물이 없습니다. '매물 검색'에서 ♡ 를 눌러 위시리스트에 담아 보세요.</p>;
  }
  const total = list.reduce((s, f) => s + f.listing.Price, 0);
  return (
    <>
      <div className="section-title">
        <h2>찜한 매물 {list.length}대</h2>
        <span className="muted">
          평균 {formatPrice(Math.round(total / list.length))}원 · 찜할 당시 가격 기준이며, 판매 완료된 매물은 엔카 링크가 열리지 않을 수 있습니다
        </span>
      </div>
      <div className="listing-grid">
        {list.map((f) => (
          <div key={f.listing.Id} className="favorite-item">
            <div className="favorite-item__car">{f.carName}</div>
            <ListingCard listing={f.listing} favorite onToggleFavorite={() => favorites.toggle(f.carId, f.carName, f.listing)} />
            <div className="muted favorite-item__date">{new Date(f.savedAt).toLocaleDateString('ko-KR')} 찜</div>
          </div>
        ))}
      </div>
    </>
  );
}

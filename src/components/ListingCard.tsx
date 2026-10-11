import { detailUrl, photoUrl } from '../api/encar';
import type { EncarListing } from '../api/types';
import { formatKm, formatPrice, formatRegDate } from '../lib/format';

interface Props {
  listing: EncarListing;
  favorite: boolean;
  onToggleFavorite: () => void;
  /** 이 차종 현재 시세 중앙값 (있으면 대비 표시) */
  marketMedian?: number;
}

export function ListingCard({ listing: l, favorite, onToggleFavorite, marketMedian }: Props) {
  const diff = marketMedian ? (l.Price / marketMedian - 1) * 100 : undefined;
  return (
    <article className="listing-card">
      <a className="listing-card__photo" href={detailUrl(l.Id)} target="_blank" rel="noreferrer">
        {photoUrl(l) ? <img src={photoUrl(l)} alt="" loading="lazy" /> : <span className="muted">사진 없음</span>}
      </a>
      <button
        className={`listing-card__fav${favorite ? ' is-on' : ''}`}
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? '찜 해제' : '찜하기'}
        title={favorite ? '찜 해제' : '찜하기'}
      >
        {favorite ? '♥' : '♡'}
      </button>
      <div className="listing-card__body">
        <a className="listing-card__title" href={detailUrl(l.Id)} target="_blank" rel="noreferrer">
          {l.Model} <span>{l.Badge}</span>
        </a>
        <div className="listing-card__meta">
          {l.FormYear}년식 · 등록 {formatRegDate(l.Year)} · {formatKm(l.Mileage)}
          {l.OfficeCityState && ` · ${l.OfficeCityState}`}
        </div>
        <div className="listing-card__price">
          <strong>{formatPrice(l.Price)}원</strong>
          {diff != null && Math.abs(diff) >= 1 && (
            <span className={`delta ${diff < 0 ? 'delta--good' : 'delta--bad'}`}>
              시세 대비 {diff > 0 ? '▲' : '▼'}
              {Math.abs(diff).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

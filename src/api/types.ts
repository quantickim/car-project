/** 엔카 검색 API가 돌려주는 매물 한 건 (사용하는 필드만) */
export interface EncarListing {
  Id: string;
  Manufacturer: string;
  Model: string;
  Badge: string;
  BadgeDetail?: string;
  /** 최초등록 연월 (YYYYMM, 예: 202108) */
  Year: number;
  /** 모델 연식 (예: "2022") */
  FormYear: string;
  Mileage: number;
  /** 만원 단위 */
  Price: number;
  SellType: string;
  FuelType?: string;
  Transmission?: string;
  OfficeCityState?: string;
  Photo?: string;
  Photos?: { type: string; location: string; ordering: number }[];
  ModifiedDate?: string;
}

export interface EncarSearchResponse {
  Count: number;
  SearchResults: EncarListing[];
}

/** 엔카 분류 경로: 제조사 > 모델그룹 > 모델(세대) > 배지그룹(연료/구동) */
export interface EncarPath {
  /** N = 수입, Y = 국산 */
  carType: 'N' | 'Y';
  manufacturer: string;
  modelGroup: string;
  model: string;
  badgeGroup?: string;
}

export interface SearchRange {
  /** 연식(최초등록 연도) */
  yearFrom?: number;
  yearTo?: number;
  /** 만원 */
  priceFrom?: number;
  priceTo?: number;
  /** km */
  mileageTo?: number;
}

export type SortKey = 'PriceAsc' | 'PriceDesc' | 'MileageAsc' | 'ModifiedDate';

export interface Facet {
  value: string;
  count: number;
}

import { useEffect, useState } from 'react';

/** 브라우저 저장소 연동 상태. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 메모리 상태로 동작한다 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

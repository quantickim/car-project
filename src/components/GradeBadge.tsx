import { GRADE_LABEL, type Confidence, type ValueGrade } from '../lib/analysis';

const ICON: Record<ValueGrade, string> = { rising: '▲', strong: '●', normal: '◐', weak: '▼' };

/** 상태 색은 아이콘 + 글자와 함께만 쓴다 */
export function GradeBadge({ grade }: { grade: ValueGrade }) {
  return (
    <span className={`grade grade--${grade}`}>
      <span aria-hidden>{ICON[grade]}</span>
      {GRADE_LABEL[grade]}
    </span>
  );
}

const CONF_LABEL: Record<Confidence, string> = { high: '높음', mid: '보통', low: '낮음' };

export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  return <span className={`conf conf--${confidence}`}>신뢰도 {CONF_LABEL[confidence]}</span>;
}

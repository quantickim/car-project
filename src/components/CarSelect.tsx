import type { CatalogCar } from '../data/catalog';

export function CarSelect({ catalog, value, onChange }: { catalog: CatalogCar[]; value: string; onChange: (id: string) => void }) {
  const groups = new Map<string, CatalogCar[]>();
  for (const c of catalog) {
    const g = c.encar.manufacturer;
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  return (
    <label className="field car-select">
      차종
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {[...groups.entries()].map(([maker, cars]) => (
          <optgroup key={maker} label={maker}>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.targetYear ? ` [${String(c.targetYear).slice(2)}년식]` : ''} · {c.hp}마력
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

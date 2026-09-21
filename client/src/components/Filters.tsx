import { CATEGORIES, CATEGORY_KEYS, type Category, type Filters } from "../lib/types.js";

type Props = {
  value: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
  totalCount: number;
};

const chip =
  "rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2";

export default function FiltersBar({
  value,
  onChange,
  resultCount,
  totalCount,
}: Props) {
  const toggleCategory = (category: Category) =>
    onChange({
      ...value,
      categories: value.categories.includes(category)
        ? value.categories.filter((c) => c !== category)
        : [...value.categories, category],
    });

  const active =
    value.categories.length > 0 ||
    value.maxCost !== null ||
    value.maxDistanceKm !== null;

  return (
    <div className="border-b border-deep/10 bg-paper px-3 py-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() =>
            onChange({ ...value, maxCost: value.maxCost === 1000 ? null : 1000 })
          }
          aria-pressed={value.maxCost === 1000}
          className={`${chip} ${
            value.maxCost === 1000
              ? "border-deep bg-deep text-paper"
              : "border-deep/20 hover:border-deep/50"
          }`}
        >
          Under KSh 1,000
        </button>

        <button
          onClick={() =>
            onChange({
              ...value,
              maxDistanceKm: value.maxDistanceKm === 5 ? null : 5,
            })
          }
          aria-pressed={value.maxDistanceKm === 5}
          className={`${chip} ${
            value.maxDistanceKm === 5
              ? "border-deep bg-deep text-paper"
              : "border-deep/20 hover:border-deep/50"
          }`}
        >
          Under 5 km
        </button>

        {CATEGORY_KEYS.map((key) => {
          const { label, emoji, color } = CATEGORIES[key];
          const on = value.categories.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              aria-pressed={on}
              className={`${chip} ${on ? "text-paper" : "border-deep/20 hover:border-deep/50"}`}
              style={on ? { background: color, borderColor: color } : undefined}
            >
              {emoji} {label}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-2 flex items-center justify-between text-sm text-ink/60">
          <span>
            {resultCount} of {totalCount} places
          </span>
          <button
            onClick={() =>
              onChange({ categories: [], maxCost: null, maxDistanceKm: null })
            }
            className="underline underline-offset-4 hover:text-ink"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
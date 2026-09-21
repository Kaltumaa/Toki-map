import { CATEGORIES, type Place } from "../lib/types.js";
import { distanceKm, formatKm, formatKsh, type LatLng } from "../lib/geo.js";

type Props = {
  place: Place;
  origin: LatLng;
  selected: boolean;
  planOrder: number | null;
  onSelect: () => void;
  onDelete: () => void;
};

export default function PlaceCard({
  place,
  origin,
  selected,
  planOrder,
  onSelect,
  onDelete,
}: Props) {
  const { label, emoji, color } = CATEGORIES[place.category];
  const km = distanceKm(origin, [place.lat, place.lng]);

  return (
    <article
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      tabIndex={0}
      aria-current={selected}
      className={`group cursor-pointer border-l-4 bg-white px-4 py-3 outline-offset-2 transition focus-visible:outline-2 ${
        selected ? "shadow-md" : "shadow-sm"
      }`}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg leading-tight font-bold tracking-tight">
            {planOrder !== null && (
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs text-paper"
                style={{ background: color }}
              >
                {planOrder}
              </span>
            )}
            {place.name}
          </h3>
          <p className="text-sm text-ink/60">{place.area}</p>
        </div>

        {place.thumbnailUrl && (
          <img
            src={place.thumbnailUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-cover"
            loading="lazy"
          />
        )}
      </div>

      <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="sr-only">Typical spend</dt>
          <dd className="font-medium">
            {place.costEstimate !== null
              ? `~${formatKsh(place.costEstimate)}`
              : "No price saved"}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Distance</dt>
          <dd className="text-ink/70">{formatKm(km)} away</dd>
        </div>
        <div>
          <dt className="sr-only">Category</dt>
          <dd className="text-ink/70">
            {emoji} {label}
          </dd>
        </div>
      </dl>

      {place.notes && <p className="mt-2 text-sm text-ink/70">{place.notes}</p>}

      <div className="mt-3 flex items-center gap-4 text-sm">
        {place.tiktokUrl && (
          <a
            href={place.tiktokUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-deep underline underline-offset-4"
          >
            Watch the video
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-ink/40 opacity-0 transition group-hover:opacity-100 hover:text-restaurant focus-visible:opacity-100"
        >
          Remove
        </button>
      </div>
    </article>
  );
}

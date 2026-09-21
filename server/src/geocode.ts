// Photon (by Komoot) — free, keyless geocoding built specifically for
// search-as-you-type autocomplete, which is exactly this feature. Same
// underlying OpenStreetMap data as Nominatim, but Photon's own service
// exists to serve typeahead traffic, so it doesn't rate-limit a normal
// app's usage the way Nominatim's general-purpose server does. No signup,
// no API key, nothing to configure.

const BASE = "https://photon.komoot.io/api/";

// Nairobi's rough bounding box, as minLon,minLat,maxLon,maxLat (GeoJSON
// bbox order). Without this, "Java House" can resolve to a match on
// another continent.
const NAIROBI_BBOX = "36.65,-1.45,37.10,-1.15";
// A point near the middle of that box, used as a soft location bias.
const NAIROBI_LAT = -1.2864;
const NAIROBI_LON = 36.8172;

/**
 * A serialised queue, not a timestamp check. The naive version reads a
 * shared `lastCall` and races: three concurrent autocomplete keystrokes all
 * see the same value, all decide they may go now, and all fire at once.
 * Chaining onto a single promise makes the spacing hold no matter how many
 * callers there are. Photon has no published hard limit for reasonable use,
 * but a small gap is still good manners on a free public service.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 300)),
    () => new Promise((r) => setTimeout(r, 300))
  );
  return run;
}

export type GeocodeResult = {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
};

// Autocomplete asks for the same prefixes over and over. A plain Map is the
// right size of solution for a single-process app.
const cache = new Map<string, GeocodeResult[]>();

type PhotonFeature = {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

function displayNameFor(p: PhotonFeature["properties"]): string {
  // Build something Nominatim-shaped: [name, street/district, city, state, country]
  const parts = [p.name, p.street ?? p.district, p.city, p.state, p.country].filter(
    (x): x is string => Boolean(x)
  );
  return parts.join(", ");
}

async function search(query: string, limit: number): Promise<GeocodeResult[]> {
  const key = `${limit}:${query.toLowerCase().trim()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const results = await enqueue(async () => {
    const url = new URL(BASE);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("lat", String(NAIROBI_LAT));
    url.searchParams.set("lon", String(NAIROBI_LON));
    url.searchParams.set("bbox", NAIROBI_BBOX);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = data.features ?? [];

    return features.map((f) => ({
      name: f.properties.name || displayNameFor(f.properties).split(",")[0],
      displayName: displayNameFor(f.properties),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  });

  // Only cache real results. Caching an empty array would mean a query that
  // fails once (network blip, brief outage) stays "wrong" for the rest of
  // the server's lifetime.
  if (results.length > 0) cache.set(key, results);
  return results;
}

/** Best single match, or null. */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const [first] = await search(query, 1);
  return first ?? null;
}

/** Up to `limit` matches, for the autocomplete on the name field. */
export function suggest(query: string, limit = 5): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return Promise.resolve([]);
  return search(query, limit);
}

/** Shorten a display name to something that fits on a card. */
export function shortArea(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim());
  // [name, street/district, city, state, country, ...] — the second part is
  // usually the neighbourhood people actually say out loud.
  return parts[1] ?? parts[0];
}

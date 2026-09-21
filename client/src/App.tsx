import { useCallback, useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView.js";
import PlaceCard from "./components/PlaceCard.js";
import AddPlaceForm from "./components/AddPlaceForm.js";
import FiltersBar from "./components/Filters.js";
import PlanMyDay from "./components/PlanMyDay.js";
import { api } from "./lib/api.js";
import { applyFilters } from "./lib/filter.js";
import { NAIROBI, type LatLng } from "./lib/geo.js";
import {
  NO_FILTERS,
  type Filters,
  type NewPlace,
  type Place,
  type PlanResult,
} from "./lib/types.js";

type Tab = "places" | "plan";

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("places");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [origin, setOrigin] = useState<LatLng>(NAIROBI);

  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    api
      .listPlaces()
      .then(setPlaces)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setOrigin([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 5000 }
    );
  }, []);

  const addPlace = useCallback(async (input: NewPlace) => {
    const saved = await api.addPlace(input);
    setPlaces((prev) => [saved, ...prev]);
    setSelectedId(saved.id);
  }, []);

  const removePlace = useCallback(
    async (id: number) => {
      const snapshot = places;
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      try {
        await api.deletePlace(id);
      } catch {
        setPlaces(snapshot);
      }
    },
    [places]
  );

  const movePlace = useCallback(async (id: number, lat: number, lng: number) => {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, lat, lng } : p)));
    try {
      await api.movePlace(id, lat, lng);
    } catch {
      const fresh = await api.listPlaces().catch(() => null);
      if (fresh) setPlaces(fresh);
    }
  }, []);

  const runPlan = useCallback(
    async (budget: number) => {
      setPlanning(true);
      try {
        setPlanResult(await api.plan(budget, origin));
      } catch (e) {
        setPlanResult({
          ok: false,
          reason: (e as Error).message,
          cheapestPossible: null,
        });
      } finally {
        setPlanning(false);
      }
    },
    [origin]
  );

  const visible = useMemo(
    () => applyFilters(places, filters, origin),
    [places, filters, origin]
  );

  const plan = planResult?.ok ? planResult.plan : null;
  const onMap = plan ? places : visible;

  const planOrder = useMemo(
    () => new Map(plan?.stops.map((s, i) => [s.id, i + 1]) ?? []),
    [plan]
  );

  const focusStop = useCallback((id: number) => {
    setSelectedId(id);
    setTab("places");
  }, []);

  const tabClass = (value: Tab) =>
    "flex-1 border-b-2 px-4 py-3 font-display font-bold tracking-tight transition " +
    (tab === value
      ? "border-cafe text-paper"
      : "border-transparent text-paper/50 hover:text-paper/80");

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col lg:h-full lg:w-[420px]">
        <header className="bg-deep px-5 pt-6 text-paper">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            TokiMap
          </h1>
          <p className="mt-1 text-paper/70">You've saved it. Now go.</p>

          <nav className="mt-5 flex" aria-label="Views">
            <button onClick={() => setTab("places")} className={tabClass("places")}>
              Saved places
            </button>
            <button onClick={() => setTab("plan")} className={tabClass("plan")}>
              Plan a day
            </button>
          </nav>
        </header>

        {tab === "places" ? (
          <>
            <AddPlaceForm onAdd={addPlace} />

            <FiltersBar
              value={filters}
              onChange={setFilters}
              resultCount={visible.length}
              totalCount={places.length}
            />

            <div className="flex-1 space-y-2 overflow-y-auto bg-paper-dim p-3">
              {loading && (
                <p className="p-4 text-sm text-ink/60">Loading your places…</p>
              )}

              {loadError && (
                <div className="p-4">
                  <p className="font-display text-lg font-bold">
                    Can't reach the server.
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    Check that the API is running on port 4000, then refresh.
                  </p>
                </div>
              )}

              {!loading && !loadError && places.length === 0 && (
                <div className="p-4">
                  <p className="font-display text-lg font-bold">
                    Nothing saved yet.
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    Paste a TikTok link above and TokiMap will put it on the map.
                  </p>
                </div>
              )}

              {!loading && places.length > 0 && visible.length === 0 && (
                <div className="p-4">
                  <p className="font-display text-lg font-bold">
                    Nothing matches those filters.
                  </p>
                  <button
                    onClick={() => setFilters(NO_FILTERS)}
                    className="mt-1 text-sm text-deep underline underline-offset-4"
                  >
                    Clear them
                  </button>
                </div>
              )}

              {visible.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  origin={origin}
                  selected={place.id === selectedId}
                  planOrder={planOrder.get(place.id) ?? null}
                  onSelect={() => setSelectedId(place.id)}
                  onDelete={() => removePlace(place.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <PlanMyDay
            result={planResult}
            busy={planning}
            onPlan={runPlan}
            onClear={() => setPlanResult(null)}
            onFocusStop={focusStop}
          />
        )}
      </aside>

      <main className="h-[55dvh] w-full lg:h-full lg:flex-1">
        <MapView
          places={onMap}
          plan={plan}
          selectedId={selectedId}
          origin={origin}
          onSelect={setSelectedId}
          onMove={movePlace}
        />
      </main>
    </div>
  );
}

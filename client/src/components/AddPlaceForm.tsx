import { useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  type Category,
  type NewPlace,
  type Suggestion,
} from "../lib/types.js";
import { api } from "../lib/api.js";

type Props = { onAdd: (place: NewPlace) => Promise<void> };

const BLANK = {
  tiktokUrl: "",
  name: "",
  area: "",
  category: "restaurant" as Category,
  costEstimate: "",
  notes: "",
};

export default function AddPlaceForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [caption, setCaption] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the user picks a suggestion we already have coordinates, so the save
  // skips geocoding entirely. Typing again clears it back to a lookup.
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Debounced lookup. Nominatim allows one request per second, so firing on
   * every keystroke would both break their policy and queue up answers to
   * prefixes the user has already typed past. 400 ms plus an AbortController
   * means at most one in-flight request, and it's always for the current text.
   */
  useEffect(() => {
    if (picked || form.name.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      try {
        setSuggestions(await api.suggest(form.name.trim(), controller.signal));
      } catch {
        // An aborted or failed lookup just means no suggestions; the user can
        // still type the area manually and let the server geocode on save.
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.name, picked]);

  async function handleUrlBlur() {
    if (!form.tiktokUrl.trim()) return setCaption(null);
    try {
      const meta = await api.preview(form.tiktokUrl.trim());
      setCaption(meta.title ?? meta.author ?? null);
    } catch {
      setCaption(null);
    }
  }

  function choose(suggestion: Suggestion) {
    setPicked(suggestion);
    setSuggestions([]);
    setForm((f) => ({ ...f, name: suggestion.name, area: suggestion.area }));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onAdd({
        name: form.name.trim(),
        area: form.area.trim(),
        category: form.category,
        costEstimate: form.costEstimate ? Number(form.costEstimate) : null,
        tiktokUrl: form.tiktokUrl.trim() || null,
        notes: form.notes.trim() || null,
        ...(picked ? { lat: picked.lat, lng: picked.lng } : {}),
      });
      setForm(BLANK);
      setCaption(null);
      setPicked(null);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full border border-deep/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-cafe";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-cafe px-5 py-3 text-left font-display font-bold tracking-tight text-ink"
      >
        Add a place
      </button>
    );
  }

  return (
    <div className="bg-deep-soft px-5 py-5 text-paper">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Add a place
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-paper/70 underline underline-offset-4"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="url" className="mb-1 block text-sm text-paper/80">
            TikTok link
          </label>
          <input
            id="url"
            value={form.tiktokUrl}
            onChange={(e) => set("tiktokUrl", e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://www.tiktok.com/@user/video/..."
            className={field}
          />
          {caption && (
            <p className="mt-1 line-clamp-2 text-xs text-paper/70">{caption}</p>
          )}
        </div>

        <div className="relative">
          <label htmlFor="name" className="mb-1 block text-sm text-paper/80">
            Place
          </label>
          <input
            id="name"
            value={form.name}
            autoComplete="off"
            onChange={(e) => {
              setPicked(null);
              set("name", e.target.value);
            }}
            placeholder="Start typing — Cultiva, Karura, Sarit…"
            className={field}
          />

          {searching && (
            <p className="mt-1 text-xs text-paper/60">Searching the map…</p>
          )}

          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full border border-deep/20 bg-paper text-ink shadow-lg">
              {suggestions.map((s) => (
                <li key={`${s.lat},${s.lng}`}>
                  <button
                    onClick={() => choose(s)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-dim"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-xs text-ink/60">{s.area}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (
            <p className="mt-1 text-xs text-cafe">
              Pinned to {picked.area} — no lookup needed when you save.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="area" className="mb-1 block text-sm text-paper/80">
            Area
          </label>
          <input
            id="area"
            value={form.area}
            onChange={(e) => set("area", e.target.value)}
            placeholder="Kilimani"
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cat" className="mb-1 block text-sm text-paper/80">
              Category
            </label>
            <select
              id="cat"
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
              className={field}
            >
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].emoji} {CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cost" className="mb-1 block text-sm text-paper/80">
              Typical spend (KSh)
            </label>
            <input
              id="cost"
              inputMode="numeric"
              value={form.costEstimate}
              onChange={(e) =>
                set("costEstimate", e.target.value.replace(/\D/g, ""))
              }
              placeholder="1500"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm text-paper/80">
            Note to self
          </label>
          <input
            id="notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Go before noon, it fills up"
            className={field}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-cafe">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.area.trim()}
          className="w-full bg-cafe px-4 py-2.5 font-display font-bold text-ink transition disabled:opacity-40"
        >
          {saving ? "Finding it on the map…" : "Save place"}
        </button>
      </div>
    </div>
  );
}

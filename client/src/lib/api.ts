import type { NewPlace, Place, PlanResult, Suggestion } from "./types.js";
import type { LatLng } from "./geo.js";

// Empty string in dev: Vite's proxy (see vite.config.ts) forwards /api to
// the local server. Set VITE_API_URL once deployed, so the built site talks
// to the real API instead of a proxy that only exists in `npm run dev`.
const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Something went wrong. Try again.");
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  listPlaces: () => request<Place[]>("/api/places"),

  addPlace: (place: NewPlace) =>
    request<Place>("/api/places", { method: "POST", body: JSON.stringify(place) }),

  movePlace: (id: number, lat: number, lng: number) =>
    request<Place>(`/api/places/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ lat, lng }),
    }),

  deletePlace: (id: number) =>
    request<void>(`/api/places/${id}`, { method: "DELETE" }),

  preview: (url: string) =>
    request<{ title: string | null; author: string | null; thumbnailUrl: string | null }>(
      `/api/preview?url=${encodeURIComponent(url)}`
    ),

  suggest: (q: string, signal?: AbortSignal) =>
    request<Suggestion[]>(`/api/suggest?q=${encodeURIComponent(q)}`, { signal }),

  plan: (budget: number, origin: LatLng) =>
    request<PlanResult>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ budget, origin }),
    }),
};
import { useEffect, useRef } from "react";
import L from "leaflet";
import { CATEGORIES, type Place, type Plan } from "../lib/types.js";
import { NAIROBI, type LatLng } from "../lib/geo.js";

type Props = {
  places: Place[];
  plan: Plan | null;
  selectedId: number | null;
  origin: LatLng;
  onSelect: (id: number) => void;
  onMove: (id: number, lat: number, lng: number) => void;
};

function pinIcon(category: Place["category"], order: number | null, dim: boolean) {
  const { emoji, color } = CATEGORIES[category];
  const inner = order === null ? emoji : String(order);

  return L.divIcon({
    className: "",
    html: `<div class="pin${dim ? " pin-dim" : ""}${
      order !== null ? " pin-ordered" : ""
    }" style="background:${color}"><span>${inner}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

export default function MapView({
  places,
  plan,
  selectedId,
  origin,
  onSelect,
  onMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<number, L.Marker>());
  const routeRef = useRef<L.Polyline | null>(null);
  const originRef = useRef<L.CircleMarker | null>(null);

  // Handlers change identity on every render; markers are bound once, so they
  // read through a ref instead of being torn down and rebound each time.
  const handlers = useRef({ onSelect, onMove });
  handlers.current = { onSelect, onMove };

  // Build the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: NAIROBI,
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      routeRef.current = null;
      originRef.current = null;
    };
  }, []);

  // Where the user is, so the distances on the cards have a visible anchor.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    originRef.current?.remove();
    originRef.current = L.circleMarker(origin, {
      radius: 7,
      color: "#083d38",
      weight: 3,
      fillColor: "#faf6ef",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("You're around here");
  }, [origin]);

  /**
   * Reconcile markers against the current list rather than clearing and
   * re-adding. Wiping the layer on every render makes pins flicker and drops
   * any open popup; diffing by id keeps untouched pins exactly as they were.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const live = new Map(places.map((p) => [p.id, p]));
    const planOrder = new Map(plan?.stops.map((s, i) => [s.id, i + 1]) ?? []);

    for (const [id, marker] of markers) {
      if (!live.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const place of places) {
      const order = planOrder.get(place.id) ?? null;
      const dim = plan !== null && order === null;
      const icon = pinIcon(place.category, order, dim);

      const existing = markers.get(place.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLatLng([place.lat, place.lng]);
        continue;
      }

      const marker = L.marker([place.lat, place.lng], {
        icon,
        title: place.name,
        draggable: true,
        autoPan: true,
      })
        .addTo(map)
        .bindPopup(`<strong>${place.name}</strong><br>${place.area}`)
        .on("click", () => handlers.current.onSelect(place.id))
        .on("dragend", (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng();
          handlers.current.onMove(place.id, lat, lng);
        });

      markers.set(place.id, marker);
    }
  }, [places, plan]);

  // The route line for an active plan.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeRef.current?.remove();
    routeRef.current = null;

    if (!plan || plan.stops.length === 0) return;

    const path: LatLng[] = [
      origin,
      ...plan.stops.map((s) => [s.lat, s.lng] as LatLng),
    ];

    routeRef.current = L.polyline(path, {
      color: "#083d38",
      weight: 3,
      opacity: 0.8,
      dashArray: "2 8",
      lineCap: "round",
    }).addTo(map);

    map.fitBounds(L.latLngBounds(path), { padding: [56, 56], maxZoom: 15 });
  }, [plan, origin]);

  // Frame everything when the visible set changes — but not while a plan is
  // showing, since the plan effect owns the viewport in that case.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || plan || places.length === 0) return;

    map.fitBounds(
      L.latLngBounds(places.map((p) => [p.lat, p.lng] as LatLng)),
      { padding: [48, 48], maxZoom: 15 }
    );
  }, [places, plan]);

  // Fly to whichever card was tapped.
  useEffect(() => {
    const map = mapRef.current;
    const place = places.find((p) => p.id === selectedId);
    if (!map || !place) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([place.lat, place.lng], 15, { duration: reduced ? 0 : 0.6 });
    markersRef.current.get(place.id)?.openPopup();
  }, [selectedId, places]);

  return <div ref={containerRef} className="h-full w-full" />;
}
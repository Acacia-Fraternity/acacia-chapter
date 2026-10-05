"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { PLACES } from "@/lib/places";

export interface MapMember {
  id: string;
  name: string;
  color: string;
  isHome: boolean;
}

export interface MapPoint {
  user_id: string;
  lat: number;
  lng: number;
  at: string;
}

const REFRESH_MS = 60_000;

export function HouseMap({
  house,
  members,
  points,
}: {
  house: { latitude: number; longitude: number; radiusMeters: number };
  members: MapMember[];
  points: MapPoint[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // Which selection the view was last fitted to — re-fit only when it
  // changes, not on the minute refresh, or the map would jump while panning.
  const fittedForRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Leaflet touches `window` on import, so it can only load in the browser.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current).setView(
        [house.latitude, house.longitude],
        15,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Leaflet only measures its container once; without this, tiles leave
      // a grey strip whenever the container size settles after mount.
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      setReady(true);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [house.latitude, house.longitude]);

  // Locations arrive via the tracker apps, not this page, so poll the server
  // component for fresh points.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const bounds: [number, number][] = [[house.latitude, house.longitude]];

    L.circle([house.latitude, house.longitude], {
      radius: house.radiusMeters,
      color: "#008675",
      weight: 1,
      fillOpacity: 0.08,
    }).addTo(layer);
    L.marker([house.latitude, house.longitude], {
      icon: L.divIcon({
        className: "",
        html: '<div style="font-size:26px;line-height:1;transform:translate(-50%,-50%)">🏠</div>',
      }),
      zIndexOffset: 1000,
    })
      .bindTooltip("Acacia house · 702 E 3rd St", { direction: "top", offset: [0, -14] })
      .addTo(layer);

    for (const place of PLACES) {
      L.circleMarker([place.lat, place.lng], {
        radius: 6,
        color: "#ffffff",
        weight: 1.5,
        fillColor: place.kind === "recreation" ? "#d97706" : "#003d4c",
        fillOpacity: 0.9,
      })
        .bindTooltip(place.name, { direction: "top" })
        .addTo(layer);
    }

    for (const member of members) {
      if (selectedId && member.id !== selectedId) continue;
      const trail = points.filter((p) => p.user_id === member.id);
      if (trail.length === 0) continue;

      const latLngs = trail.map((p) => [p.lat, p.lng] as [number, number]);
      latLngs.forEach((ll) => bounds.push(ll));

      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: member.color, weight: 3, opacity: 0.65 }).addTo(layer);
      }
      trail.forEach((p) => {
        L.circleMarker([p.lat, p.lng], {
          radius: 3,
          color: member.color,
          fillColor: member.color,
          fillOpacity: 1,
          weight: 1,
        })
          .bindTooltip(
            `${member.name} · ${new Date(p.at).toLocaleString([], {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}`,
          )
          .addTo(layer);
      });

      const last = trail[trail.length - 1];
      L.circleMarker([last.lat, last.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: member.color,
        fillOpacity: 1,
      })
        .bindTooltip(member.name, { permanent: true, direction: "right", offset: [10, 0] })
        .addTo(layer);
    }

    const fitKey = selectedId ?? "all";
    if (fittedForRef.current !== fitKey) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      fittedForRef.current = fitKey;
    }
  }, [ready, members, points, selectedId, house]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedId(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            selectedId === null
              ? "border-acacia-gold bg-acacia-gold/25"
              : "border-surface-border"
          }`}
        >
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              selectedId === m.id
                ? "border-acacia-gold bg-acacia-gold/25"
                : "border-surface-border"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: m.color }}
            />
            {m.name}
            {m.isHome && <span className="text-acacia-green">· home</span>}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border border-surface-border"
      />
    </div>
  );
}

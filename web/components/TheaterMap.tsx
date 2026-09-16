"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TheaterEvent } from "@intel-os/core";
import { symbolFor } from "@/lib/symbols";

// NFR-4/NFR-5: MapLibre (BSD) + OpenStreetMap-derived vector tiles. No token, no
// commercial tile service that can revoke access. Interim style is OpenFreeMap;
// the same style/tiles self-host (Protomaps/OpenMapTiles) for restricted-network
// deployments — swap STYLE_URL only.
const STYLE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/dark";
const LABEL_FONT = ["Noto Sans Regular"];

interface Props {
  events: TheaterEvent[]; // pre-filtered, all with lat/lon
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function toGeoJSON(events: TheaterEvent[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lon!, e.lat!] },
      properties: {
        id: e.id,
        sidc: symbolFor(e).sidc,
        title: e.title,
        place: e.placeName,
      },
    })),
  };
}

export default function TheaterMap({ events, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [47, 26],
      zoom: 4,
    });
    mapRef.current = map;
    (window as unknown as { __theaterMap?: maplibregl.Map }).__theaterMap = map;
    map.on("error", (e: maplibregl.ErrorEvent) => console.error("[theater-map]", e.error?.message ?? e));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));

    map.on("style.load", () => {
      map.addSource("events", {
        type: "geojson",
        data: toGeoJSON(eventsRef.current),
        cluster: true,
        clusterMaxZoom: 7,
        clusterRadius: 42,
      });

      // UX-5: cluster at low zoom…
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#03034d",
          "circle-stroke-color": "rgba(242,242,242,0.55)",
          "circle-stroke-width": 1.5,
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 24],
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": LABEL_FONT,
        },
        paint: { "text-color": "#f2f2f2" },
      });
      // …individual 2525 symbols at high zoom
      map.addLayer({
        id: "event-symbols",
        type: "symbol",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "sidc"],
          "icon-size": 1,
          "icon-allow-overlap": true,
          "text-field": ["get", "place"],
          "text-size": 10,
          "text-offset": [0, 1.8],
          "text-optional": true,
          "text-font": LABEL_FONT,
        },
        paint: {
          "text-color": "#f2f2f2",
          "text-halo-color": "#000033",
          "text-halo-width": 1.2, // GEO-5: halo keeps labels legible over linework
        },
      });

      map.on("click", "event-symbols", (ev: maplibregl.MapLayerMouseEvent) => {
        const f = ev.features?.[0];
        if (f?.properties?.id) onSelect(String(f.properties.id));
      });
      map.on("click", "clusters", async (ev: maplibregl.MapLayerMouseEvent) => {
        const f = ev.features?.[0];
        if (!f) return;
        const src = map.getSource("events") as maplibregl.GeoJSONSource;
        try {
          const z = await src.getClusterExpansionZoom(f.properties?.cluster_id);
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
        } catch {
          // cluster vanished between click and expansion — nothing to do
        }
      });
      map.on("mouseenter", "event-symbols", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "event-symbols", () => (map.getCanvas().style.cursor = ""));

      readyRef.current = true;
      syncData(map, eventsRef.current);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep source + symbol images in sync with filtered events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncData(map, events);
  }, [events]);

  // fly to selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const ev = events.find((e) => e.id === selectedId);
    if (ev && ev.lat != null && ev.lon != null) {
      map.easeTo({ center: [ev.lon, ev.lat], zoom: Math.max(map.getZoom(), 6.5), duration: 600 });
    }
  }, [selectedId, events]);

  // Inline style: the renderer's stylesheet sets `position: relative` on the
  // container class, which beats a Tailwind `absolute` in the cascade and
  // collapses the div to zero height. Inline wins over both.
  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}

function syncData(map: maplibregl.Map, events: TheaterEvent[]) {
  // register any missing 2525 symbol images, then update the source
  const pending: Promise<void>[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const { sidc, url, width, height } = symbolFor(e);
    if (seen.has(sidc) || map.hasImage(sidc)) continue;
    seen.add(sidc);
    pending.push(
      new Promise((resolve) => {
        const img = new Image(width, height);
        img.onload = () => {
          if (!map.hasImage(sidc)) map.addImage(sidc, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      }),
    );
  }
  void Promise.all(pending).then(() => {
    const src = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
    src?.setData(toGeoJSON(events));
    // Fit once on first data; afterwards the analyst's pan/zoom is theirs.
    if (events.length > 0 && !fittedMaps.has(map)) {
      fittedMaps.add(map);
      const b = new maplibregl.LngLatBounds();
      for (const e of events) b.extend([e.lon!, e.lat!]);
      map.fitBounds(b, { padding: 80, maxZoom: 7, duration: 500 });
    }
  });
}

const fittedMaps = new WeakSet<maplibregl.Map>();

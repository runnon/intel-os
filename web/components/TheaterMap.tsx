"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { TheaterEvent } from "@intel-os/core";
import { symbolFor } from "@/lib/symbols";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!TOKEN || !container.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [47, 26], // CENTCOM-ish default; fitBounds adjusts on data
      zoom: 4,
      attributionControl: true,
    });
    mapRef.current = map;
    (window as unknown as { __theaterMap?: mapboxgl.Map }).__theaterMap = map;
    map.on("error", (e) => console.error("[theater-map]", e.error?.message ?? e));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }));

    // style.load (not load): sources/layers can attach as soon as the style is
    // parsed, and unlike `load` it doesn't wait on every basemap tile settling.
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
          "circle-color": "#1d2b38",
          "circle-stroke-color": "#7b8894",
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
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#d7dde4" },
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
          "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#c6d1db",
          "text-halo-color": "#0b0f13",
          "text-halo-width": 1.2, // GEO-5: halo keeps labels legible over linework
        },
      });

      map.on("click", "event-symbols", (ev) => {
        const f = ev.features?.[0];
        if (f?.properties?.id) onSelect(String(f.properties.id));
      });
      map.on("click", "clusters", (ev) => {
        const f = ev.features?.[0];
        if (!f) return;
        const clusterId = f.properties?.cluster_id;
        (map.getSource("events") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, z) => {
          if (err || z == null) return;
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
        });
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

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0d1319]">
        <div className="text-center max-w-sm px-6">
          <p className="font-mono text-sm text-amber-300 mb-2">MAP UNAVAILABLE</p>
          <p className="text-xs text-[#8b98a5]">
            Set <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> to render the theater
            map. Events remain available in the list — a degraded picture states its degradation.
          </p>
        </div>
      </div>
    );
  }
  // Inline style: mapbox-gl.css sets `.mapboxgl-map { position: relative }`,
  // which beats a Tailwind `absolute` class in the cascade and collapses the
  // container to zero height. Inline wins over both.
  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}

function syncData(map: mapboxgl.Map, events: TheaterEvent[]) {
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
    const src = map.getSource("events") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(toGeoJSON(events));
    // Fit once on first data; afterwards the analyst's pan/zoom is theirs.
    if (events.length > 0 && !fittedMaps.has(map)) {
      fittedMaps.add(map);
      const b = new mapboxgl.LngLatBounds();
      for (const e of events) b.extend([e.lon!, e.lat!]);
      map.fitBounds(b, { padding: 80, maxZoom: 7, duration: 500 });
    }
  });
}

const fittedMaps = new WeakSet<mapboxgl.Map>();

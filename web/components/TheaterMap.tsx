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
  process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";
const LABEL_FONT = ["Noto Sans Regular"];

export interface NumberedEvent extends TheaterEvent {
  num: number; // chronological serial within the issue (proof-build style)
}

interface Props {
  events: NumberedEvent[]; // pre-filtered, all with lat/lon
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Display positions, computed in SCREEN pixels at the current zoom: symbols
 * whose true points would overlap are displaced in a ring sized in pixels and
 * tied back to their true position with a hairline — the proof build's own
 * convention ("symbols displaced for legibility; a hairline ties each to its
 * true point"). Displacement collapses automatically as you zoom in, because
 * the same pixel radius covers ever less ground. True positions stay in the data.
 */
const SPREAD_PX = 30; // ring radius in screen pixels
const GROUP_PX = 34; // symbols closer than this (px) get grouped

function displaced(events: NumberedEvent[], zoom: number): Map<string, [number, number]> {
  const lonPerPx = 360 / (512 * Math.pow(2, zoom));
  const groups = new Map<string, NumberedEvent[]>();
  for (const e of events) {
    const latScale = Math.max(0.2, Math.cos((e.lat! * Math.PI) / 180));
    const key = `${Math.round(e.lon! / (GROUP_PX * lonPerPx))}:${Math.round(e.lat! / (GROUP_PX * lonPerPx * latScale))}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const out = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.set(group[0].id, [group[0].lon!, group[0].lat!]);
      continue;
    }
    const cx = group.reduce((a, e) => a + e.lon!, 0) / group.length;
    const cy = group.reduce((a, e) => a + e.lat!, 0) / group.length;
    const latScale = Math.max(0.2, Math.cos((cy * Math.PI) / 180));
    // ring radius grows a little with group size so 4+ don't touch
    const rPx = SPREAD_PX + Math.max(0, group.length - 3) * 8;
    const rLon = rPx * lonPerPx;
    const rLat = rPx * lonPerPx * latScale;
    group.forEach((e, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      out.set(e.id, [cx + rLon * Math.cos(angle), cy + rLat * Math.sin(angle)]);
    });
  }
  return out;
}

function toGeoJSON(events: NumberedEvent[], zoom: number): {
  points: GeoJSON.FeatureCollection;
  leaders: GeoJSON.FeatureCollection;
} {
  const pos = displaced(events, zoom);
  const points: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: pos.get(e.id)! },
      properties: {
        id: e.id,
        sidc: symbolFor(e).sidc,
        num: String(e.num),
        title: e.title,
        place: e.placeName,
      },
    })),
  };
  const leaders: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: events
      .filter((e) => {
        const p = pos.get(e.id)!;
        return p[0] !== e.lon! || p[1] !== e.lat!;
      })
      .map((e) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[e.lon!, e.lat!], pos.get(e.id)!] },
        properties: {},
      })),
  };
  return { points, leaders };
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
      recolorToPrint(map);
      map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": 22,
          "circle-color": "rgba(23,23,18,0.08)",
          "circle-stroke-color": "#171712",
          "circle-stroke-width": 2,
        },
      });
      const initial = toGeoJSON(eventsRef.current, map.getZoom());
      map.addSource("leaders", { type: "geojson", data: initial.leaders });
      map.addLayer({
        id: "event-leaders",
        type: "line",
        source: "leaders",
        paint: { "line-color": "#171712", "line-width": 0.8, "line-opacity": 0.6 },
      });
      map.addSource("events", { type: "geojson", data: initial.points });

      // Every event stays individually visible with its serial number — no
      // clustering (proof-build convention; tight groups are displaced instead).
      map.addLayer({
        id: "event-symbols",
        type: "symbol",
        source: "events",
        layout: {
          "icon-image": ["get", "sidc"],
          "icon-size": 1,
          "icon-allow-overlap": true,
          "text-field": ["step", ["zoom"], "", 5.2, ["get", "place"]],
          "text-size": 10,
          "text-offset": [0, 1.8],
          "text-optional": true,
          "text-font": LABEL_FONT,
        },
        paint: {
          "text-color": "#171712",
          "text-halo-color": "#f5f2ea",
          "text-halo-width": 1.2, // GEO-5: halo keeps labels legible over linework
        },
      });
      // serial number centered INSIDE the frame, proof-build style
      map.addLayer({
        id: "event-numbers",
        type: "symbol",
        source: "events",
        layout: {
          "text-field": ["get", "num"],
          "text-size": 10,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": LABEL_FONT,
        },
        paint: {
          "text-color": "#171712",
        },
      });

      map.on("click", "event-symbols", (ev: maplibregl.MapLayerMouseEvent) => {
        const f = ev.features?.[0];
        if (f?.properties?.id) onSelect(String(f.properties.id));
      });
      map.on("mouseenter", "event-symbols", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "event-symbols", () => (map.getCanvas().style.cursor = ""));

      readyRef.current = true;
      syncData(map, eventsRef.current);
      let lastZoom = map.getZoom();
      map.on("zoomend", () => {
        const z = map.getZoom();
        if (Math.abs(z - lastZoom) < 0.25) return;
        lastZoom = z;
        syncData(map, eventsRef.current);
      });
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

  // fly to selection + highlight ring
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const ev = selectedId ? events.find((e) => e.id === selectedId) : null;
    const src = map.getSource("selected") as maplibregl.GeoJSONSource | undefined;
    if (ev && ev.lat != null && ev.lon != null) {
      const pos = displaced(events, map.getZoom()).get(ev.id)!;
      src?.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: pos }, properties: {} }] });
      map.easeTo({ center: pos, zoom: Math.max(map.getZoom(), 5.6), duration: 500, padding: { left: 400 } });
    } else {
      src?.setData({ type: "FeatureCollection", features: [] });
    }
  }, [selectedId, events]);

  // Inline style: the renderer's stylesheet sets `position: relative` on the
  // container class, which beats a Tailwind `absolute` in the cascade and
  // collapses the div to zero height. Inline wins over both.
  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}

function syncData(map: maplibregl.Map, events: NumberedEvent[]) {
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
    const data = toGeoJSON(events, map.getZoom());
    const src = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
    src?.setData(data.points);
    (map.getSource("leaders") as maplibregl.GeoJSONSource | undefined)?.setData(data.leaders);
    // Fit once on first data; afterwards the analyst's pan/zoom is theirs.
    if (events.length > 0 && !fittedMaps.has(map)) {
      fittedMaps.add(map);
      const b = new maplibregl.LngLatBounds();
      for (const e of events) b.extend([e.lon!, e.lat!]);
      map.fitBounds(b, { padding: 80, maxZoom: 7, duration: 500 });
    }
  });
}

/**
 * Recolor the open basemap to the proof-build print palette: cream land, tan
 * terrain, slate-blue water, muted ink linework. Pure client-side paint edits
 * on OpenFreeMap tiles — no new network dependency (NFR-4/5 intact).
 */
function recolorToPrint(map: maplibregl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    const id = layer.id;
    try {
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#ede7d5");
      } else if (layer.type === "fill") {
        if (/water|ocean|river|lake/i.test(id)) {
          map.setPaintProperty(id, "fill-color", "#c7d4d8");
        } else if (/landcover|park|wood|grass|vegetation/i.test(id)) {
          map.setPaintProperty(id, "fill-color", "#e4dec7");
        } else if (/landuse|residential|building/i.test(id)) {
          map.setPaintProperty(id, "fill-color", "#e8e1cd");
        } else {
          map.setPaintProperty(id, "fill-color", "#ece5d2");
        }
        map.setPaintProperty(id, "fill-outline-color", "rgba(23,23,18,0.06)");
      } else if (layer.type === "line") {
        if (/water|river/i.test(id)) map.setPaintProperty(id, "line-color", "#b3c3c9");
        else if (/boundary|admin/i.test(id)) map.setPaintProperty(id, "line-color", "#8f8a76");
        else map.setPaintProperty(id, "line-color", "#d6cfb8");
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", "#5c584a");
        map.setPaintProperty(id, "text-halo-color", "#f0ebdc");
      }
    } catch {
      // some layers reject some properties — skip them
    }
  }
}

const fittedMaps = new WeakSet<maplibregl.Map>();

"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Aor, LineFeature, TheaterEvent } from "@intel-os/core";
import { referencedLines } from "@intel-os/core";
import { symbolFor } from "@/lib/symbols";

// NFR-4/NFR-5: MapLibre (BSD) + OpenStreetMap-derived vector tiles. No token, no
// commercial tile service that can revoke access. Interim style is OpenFreeMap;
// the same style/tiles self-host (Protomaps/OpenMapTiles) for restricted-network
// deployments — swap STYLE_URL only.
const STYLE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";
const LABEL_FONT = ["Noto Sans Regular"];

// Selection ring: affiliation-colored stroke (matches the side-list serial and
// callout accent) over a faint neutral halo, so the highlighted icon reads
// clearly regardless of its own fill color.
const RING_COLOR: Record<string, string> = {
  hostile: "#a02c2c",
  friendly: "#1f4e79",
  neutral: "#1a7f37",
  unknown: "#b08800",
};
const RING_HALO = "rgba(23,23,18,0.10)";

export interface NumberedEvent extends TheaterEvent {
  num: number; // chronological serial within the issue (proof-build style)
}

interface Props {
  events: NumberedEvent[]; // pre-filtered, all with lat/lon
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // Report/export map: keep the WebGL frame so window.print() captures the map
  // (a default MapLibre canvas prints blank) and re-fit/redraw around printing.
  forExport?: boolean;
  // All in-window events (incl. unplotted) used only to decide which linear
  // infrastructure to draw — a pipeline shows if any event mentions it, even
  // when that event itself has no plotted point. Defaults to `events`.
  referenceEvents?: NumberedEvent[];
}

/**
 * Display positions: symbols in tight groups (e.g. the Bahrain cluster) are
 * displaced in a small ring for legibility — the proof build does the same and
 * the practice is disclosed in the footer. True positions stay in the data.
 */
function displaced(events: NumberedEvent[]): Map<string, [number, number]> {
  const groups = new Map<string, NumberedEvent[]>();
  for (const e of events) {
    const key = `${Math.round(e.lat! / 0.35)}:${Math.round(e.lon! / 0.35)}`;
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
    group.forEach((e, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      out.set(e.id, [cx + 0.28 * Math.cos(angle), cy + 0.22 * Math.sin(angle)]);
    });
  }
  return out;
}

function toGeoJSON(events: NumberedEvent[]): GeoJSON.FeatureCollection {
  const pos = displaced(events);
  return {
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
}

export default function TheaterMap({ events, selectedId, onSelect, forExport = false, referenceEvents }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const refEventsRef = useRef(referenceEvents ?? events);
  refEventsRef.current = referenceEvents ?? events;
  // Current on-screen (decluttered) position of each event, id -> [lng,lat];
  // kept in sync so the selection ring lands on the displaced icon.
  const layoutRef = useRef<Map<string, [number, number]>>(new Map());
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [47, 26],
      zoom: 4,
      // Without this the map's WebGL buffer is cleared after each frame, so
      // window.print() / html-to-image captures a blank canvas (UX-5 export).
      // maplibre-gl v5 nests it under canvasContextAttributes.
      canvasContextAttributes: { preserveDrawingBuffer: forExport },
    });
    mapRef.current = map;
    (window as unknown as { __theaterMap?: maplibregl.Map }).__theaterMap = map;
    map.on("error", (e: maplibregl.ErrorEvent) => console.error("[theater-map]", e.error?.message ?? e));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));

    // Keep the canvas matched to its container (covers a container that gets its
    // size after mount, and the print reflow) so the map always fills its width.
    const ro = new ResizeObserver(() => map.resize());
    if (container.current) ro.observe(container.current);

    map.on("style.load", () => {
      recolorToPrint(map);

      // Public-source linear infrastructure, drawn beneath event symbols. A pale
      // casing keeps the geometry readable against both land and water.
      map.addSource("infra-lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "infra-lines-casing",
        type: "line",
        source: "infra-lines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f5f2ea", "line-width": 5, "line-opacity": 0.88 },
      });
      // Pipelines: dark amber, tightly dashed. line-dasharray is not
      // data-driven, so pipelines and shipping corridors use separate layers.
      map.addLayer({
        id: "infra-lines-pipeline",
        type: "line",
        source: "infra-lines",
        filter: ["==", ["get", "kind"], "pipeline"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#8a6100", "line-width": 2.5, "line-dasharray": [2, 1.5] },
      });
      // Shipping routes / SLOCs: blue, longer dash.
      map.addLayer({
        id: "infra-lines-corridor",
        type: "line",
        source: "infra-lines",
        filter: ["==", ["get", "kind"], "corridor"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1f4e79", "line-width": 2.5, "line-dasharray": [5, 2] },
      });
      map.addLayer({
        id: "infra-line-labels",
        type: "symbol",
        source: "infra-lines",
        layout: {
          "symbol-placement": "line-center",
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-font": LABEL_FONT,
          "text-letter-spacing": 0.08,
        },
        paint: {
          "text-color": ["match", ["get", "kind"], "corridor", "#1f4e79", "#8a6100"],
          "text-halo-color": "#f5f2ea",
          "text-halo-width": 1.4,
        },
      });

      map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": 21,
          "circle-color": ["get", "halo"],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 3,
        },
      });
      // Hairline leaders + true-position ticks for displaced icons. Populated by
      // relayout(); the interactive map draws them, the report map leaves them
      // empty (invisible at theater scale). Added beneath the symbols.
      map.addSource("leaders", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "leaders",
        type: "line",
        source: "leaders",
        paint: { "line-color": "rgba(23,23,18,0.5)", "line-width": 0.8 },
      });
      map.addSource("truepoints", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "truepoints",
        type: "circle",
        source: "truepoints",
        paint: {
          "circle-radius": 2,
          "circle-color": "#171712",
          "circle-stroke-color": "#f5f2ea",
          "circle-stroke-width": 0.8,
        },
      });

      map.addSource("events", {
        type: "geojson",
        data: toGeoJSON(eventsRef.current),
      });

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

      const routePopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        className: "infrastructure-popup",
      });
      const showRoutePopup = (ev: maplibregl.MapLayerMouseEvent) => {
        const properties = ev.features?.[0]?.properties;
        if (!properties) return;
        const card = document.createElement("div");
        const name = document.createElement("strong");
        const detail = document.createElement("span");
        const source = document.createElement("small");
        name.textContent = String(properties.name);
        detail.textContent = properties.kind === "pipeline" ? "Oil / gas pipeline" : "Shipping route";
        source.textContent = `${String(properties.accuracy)} · ${String(properties.sourceName)}`;
        card.append(name, detail, source);
        routePopup.setLngLat(ev.lngLat).setDOMContent(card).addTo(map);
      };
      for (const layerId of ["infra-lines-pipeline", "infra-lines-corridor"]) {
        map.on("mouseenter", layerId, (ev) => {
          map.getCanvas().style.cursor = "help";
          showRoutePopup(ev);
        });
        map.on("mousemove", layerId, showRoutePopup);
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          routePopup.remove();
        });
      }

      readyRef.current = true;
      const activeLines = syncInfraLines(map, refEventsRef.current);
      fitToContent(map, eventsRef.current, activeLines, false, forExport);
      // Register the symbol images, then lay out (declutter) at the fitted view.
      void ensureImages(map, eventsRef.current).then(() =>
        relayout(map, eventsRef.current, layoutRef.current, !forExport, selectedIdRef.current),
      );
      // Interactive map: re-declutter whenever the view changes so icons stay
      // spread (with leaders) at every zoom, and return to true spots when zoomed in.
      if (!forExport) {
        map.on("moveend", () => {
          if (readyRef.current) relayout(map, eventsRef.current, layoutRef.current, true, selectedIdRef.current);
        });
      }
    });

    // Print path: the sheet reflows to the page width, so resize the canvas and
    // re-fit the events to it just before the browser snapshots for the PDF.
    const onBeforePrint = () => {
      if (!readyRef.current) return;
      map.resize();
      fitToContent(map, eventsRef.current, referencedFor(refEventsRef.current), false, forExport);
      relayout(map, eventsRef.current, layoutRef.current, !forExport, selectedIdRef.current);
      map.triggerRepaint();
    };
    const onAfterPrint = () => {
      if (readyRef.current) map.resize();
    };
    if (forExport) {
      window.addEventListener("beforeprint", onBeforePrint);
      window.addEventListener("afterprint", onAfterPrint);
    }

    return () => {
      if (forExport) {
        window.removeEventListener("beforeprint", onBeforePrint);
        window.removeEventListener("afterprint", onAfterPrint);
      }
      ro.disconnect();
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
    syncInfraLines(map, referenceEvents ?? events);
    if (forExport) fitToContent(map, events, referencedFor(referenceEvents ?? events), false, true);
    void ensureImages(map, events).then(() =>
      relayout(map, events, layoutRef.current, !forExport, selectedIdRef.current),
    );
  }, [events, referenceEvents, forExport]);

  // highlight ring on the selected icon (drawn identically whether the event was
  // picked on the map or in the side list) + recenter only when needed
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const ev = selectedId ? events.find((e) => e.id === selectedId) : null;
    const src = map.getSource("selected") as maplibregl.GeoJSONSource | undefined;
    if (ev && ev.lat != null && ev.lon != null) {
      const pos = layoutRef.current.get(ev.id) ?? ([ev.lon, ev.lat] as [number, number]);
      const color = RING_COLOR[ev.affiliation] ?? RING_COLOR.unknown;
      src?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: pos }, properties: { color, halo: RING_HALO } }],
      });
      // Only move the map if the icon isn't comfortably visible — off the canvas,
      // too close to an edge, or sitting behind the docked selection callout
      // (top-left, ~330px wide). If it's already in the clear, leave the view put.
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const p = map.project(pos as [number, number]);
      const EDGE = 48;
      const CALLOUT_RIGHT = 350; // callout left(12) + width(330) + margin
      const offscreen = p.x < EDGE || p.x > w - EDGE || p.y < EDGE || p.y > h - EDGE;
      const behindCallout = p.x < CALLOUT_RIGHT && p.y > 80 && p.y < h - 48;
      if (offscreen || behindCallout) {
        map.easeTo({ center: pos, zoom: Math.max(map.getZoom(), 5.6), duration: 500, padding: { left: 380 } });
      }
    } else {
      src?.setData({ type: "FeatureCollection", features: [] });
    }
  }, [selectedId, events]);

  // Inline style: the renderer's stylesheet sets `position: relative` on the
  // container class, which beats a Tailwind `absolute` in the cascade and
  // collapses the div to zero height. Inline wins over both.
  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}

function referencedFor(refEvents: NumberedEvent[]): LineFeature[] {
  const aor = refEvents[0]?.aor as Aor | undefined;
  return aor ? referencedLines(refEvents, aor) : [];
}

// Draw the pipelines/shipping routes referenced by the current events
// (mentioned → shown), and return them for initial viewport fitting.
function syncInfraLines(map: maplibregl.Map, refEvents: NumberedEvent[]): LineFeature[] {
  const src = map.getSource("infra-lines") as maplibregl.GeoJSONSource | undefined;
  const lines = referencedFor(refEvents);
  if (!src) return lines;
  src.setData({
    type: "FeatureCollection",
    features: lines.map((l) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: l.coordinates },
      properties: {
        name: l.name,
        kind: l.kind,
        basis: l.basis,
        accuracy: l.accuracy,
        sourceName: l.sourceName,
      },
    })),
  });
  return lines;
}

// Register any missing 2525 symbol images on a given map instance.
function ensureImages(map: maplibregl.Map, events: NumberedEvent[]): Promise<void> {
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
  return Promise.all(pending).then(() => {});
}

/**
 * Screen-space declutter: at the CURRENT zoom, push colliding symbols apart
 * until none overlap, then place icons at the resolved positions. On the live
 * map (`withLeaders`) each moved symbol gets a hairline back to its true spot
 * with a tick marking the real point; the report map fans out without leaders
 * (invisible at theater scale). Records each icon's on-screen position in
 * `layout` so the selection ring can follow, and keeps that ring on the icon.
 * Must run after the map has fitted / moved (projection stable).
 */
const ICON_MIN_PX = 30; // minimum center-to-center spacing between symbols
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function relayout(
  map: maplibregl.Map,
  events: NumberedEvent[],
  layout: Map<string, [number, number]>,
  withLeaders: boolean,
  selectedId: string | null,
) {
  const evSrc = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
  if (!evSrc) return;
  const leaderSrc = map.getSource("leaders") as maplibregl.GeoJSONSource | undefined;
  const trueSrc = map.getSource("truepoints") as maplibregl.GeoJSONSource | undefined;
  const selSrc = map.getSource("selected") as maplibregl.GeoJSONSource | undefined;

  const plotted = events.filter((e) => e.lat != null && e.lon != null);
  const pts = plotted.map((e, i) => {
    const p = map.project([e.lon!, e.lat!]);
    return { e, tx: p.x, ty: p.y, x: p.x, y: p.y, i };
  });

  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        let dx = pts[b].x - pts[a].x;
        let dy = pts[b].y - pts[a].y;
        let d = Math.hypot(dx, dy);
        if (d >= ICON_MIN_PX) continue;
        if (d < 0.001) {
          const ang = (pts[b].i % 8) * (Math.PI / 4);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const push = (ICON_MIN_PX - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        pts[a].x -= ux * push;
        pts[a].y -= uy * push;
        pts[b].x += ux * push;
        pts[b].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  layout.clear();
  const evFeatures: GeoJSON.Feature[] = [];
  const leaderFeatures: GeoJSON.Feature[] = [];
  const trueFeatures: GeoJSON.Feature[] = [];
  for (const pt of pts) {
    const disp = map.unproject([pt.x, pt.y]);
    const coord: [number, number] = [disp.lng, disp.lat];
    layout.set(pt.e.id, coord);
    evFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { id: pt.e.id, sidc: symbolFor(pt.e).sidc, num: String(pt.e.num), place: pt.e.placeName },
    });
    if (withLeaders && Math.hypot(pt.x - pt.tx, pt.y - pt.ty) > 4) {
      const t = map.unproject([pt.tx, pt.ty]);
      leaderFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[t.lng, t.lat], coord] },
        properties: {},
      });
      trueFeatures.push({ type: "Feature", geometry: { type: "Point", coordinates: [t.lng, t.lat] }, properties: {} });
    }
  }
  evSrc.setData({ type: "FeatureCollection", features: evFeatures });
  leaderSrc?.setData(withLeaders ? { type: "FeatureCollection", features: leaderFeatures } : EMPTY_FC);
  trueSrc?.setData(withLeaders ? { type: "FeatureCollection", features: trueFeatures } : EMPTY_FC);

  // keep the selection ring on the (possibly displaced) icon
  if (selectedId && selSrc && layout.has(selectedId)) {
    const ev = events.find((e) => e.id === selectedId);
    if (ev) {
      const color = RING_COLOR[ev.affiliation] ?? RING_COLOR.unknown;
      selSrc.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: layout.get(selectedId)! }, properties: { color, halo: RING_HALO } }],
      });
    }
  }
}

/** Frame the map to contain plotted events plus any referenced route geometry.
 * Used on first load and again at print time once the canvas is page-sized.
 * The report/export map fits tighter (smaller margins, more zoom) than the
 * interactive map, which keeps looser margins for panning and overlay clearance. */
function fitToContent(
  map: maplibregl.Map,
  events: NumberedEvent[],
  lines: LineFeature[],
  animate: boolean,
  tight = false,
) {
  if (events.length === 0 && lines.length === 0) return;
  const b = new maplibregl.LngLatBounds();
  for (const e of events) b.extend([e.lon!, e.lat!]);
  for (const line of lines) {
    for (const coordinate of line.coordinates) b.extend(coordinate);
  }
  map.fitBounds(b, {
    // report map: enough margin that edge icons (and any declutter spread) stay
    // clear of the frame; interactive map: looser still for panning/overlays.
    padding: tight ? 60 : 80,
    maxZoom: tight ? 9 : 7,
    duration: animate ? 500 : 0,
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

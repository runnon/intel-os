# Linear map data

The application bundles reviewed route geometry so the map does not depend on a
routing API at runtime.

- Maritime corridor coordinates were generated at 5 km resolution with
  [Eurostat SeaRoute](https://github.com/eurostat/searoute), whose network is
  based on the Oak Ridge National Laboratory Global Shipping Lane Network and
  additional AIS-derived European links. `maritime-route-inputs.csv` records the
  route endpoints used for reproducibility. These are representative shipping
  corridors, not live vessel tracks or navigation instructions.
- CENTCOM oil-pipeline alignments were simplified to map scale from Global
  Energy Monitor's June 2026 Global Oil Infrastructure Tracker geometry in
  `GOIT-Hormuz-alternative-routes-2026-06.gpkg` at repository commit
  `3a8146fd84388a9c3d45440903199a6c08a4350b`. The source accuracy field is
  retained in `src/features.ts`.
- Features marked `approximate` in `src/features.ts` remain visible only as
  public-reference context and are labeled accordingly in the map tooltip.

The source datasets are build-time research inputs only. No third-party route
service, token, or CDN is required to draw the bundled lines.

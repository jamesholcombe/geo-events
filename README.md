# geo-events

An in-memory **geospatial stream processor**: feed it location updates, get back structured spatial events — `enter` / `exit` geofences, `approach` / `recede` radius zones, `assignment_changed` catalog regions, and more.

First-class **TypeScript / Node.js** bindings via native NAPI. Also ships as a Rust library, an NDJSON CLI, and an optional HTTP adapter.

---

## TypeScript / Node.js

### Requirements

- Node.js 18+
- The pre-built native module for your platform, or build from source (see [Building the native module](#building-the-native-module))

### Install

> The npm package is not yet published. To use from source, build the native module and link it:
>
> ```bash
> make napi-build
> ```

### Quick start

```typescript
import { GeoEngine } from './crates/adapters/napi/types'

const engine = new GeoEngine()

// Register a geofence (GeoJSON polygon)
engine.registerGeofence('city-centre', {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
})

// Ingest a location update
const events = engine.ingest([
  { id: 'vehicle-1', x: 0.5, y: 0.5, tMs: Date.now() },
])

console.log(events)
// [{ kind: 'enter', id: 'vehicle-1', geofence: 'city-centre', t_ms: 1700000000000 }]
```

### API

#### `new GeoEngine()`

Creates a new, empty engine instance. Each instance tracks its own set of zones and entity states.

#### `registerGeofence(id, polygon, dwell?)`

Register a named geofence from a GeoJSON `Polygon` object. Optionally provide dwell thresholds to debounce enter/exit events when an entity hovers near a boundary.

```typescript
engine.registerGeofence('warehouse', polygon, {
  minInsideMs: 5_000,   // must be inside for ≥ 5 s before 'enter' fires
  minOutsideMs: 3_000,  // must be outside for ≥ 3 s before 'exit' fires
})
```

#### `registerCorridor(id, polygon)`

Register a named corridor. Emits `enter_corridor` / `exit_corridor` as entities pass through.

#### `registerCatalogRegion(id, polygon)`

Register a catalog region. Emits `assignment_changed` whenever an entity's containing region changes, including when it leaves all regions (`region: null`).

#### `registerRadiusZone(id, cx, cy, radius)`

Register a circular zone defined by a centre point and radius (same coordinate units as your location data).

#### `ingest(updates)`

Process a batch of point updates. Returns all spatial events fired by the batch as a typed `GeoEvent[]`.

```typescript
const events = engine.ingest([
  { id: 'vehicle-1', x: 0.5, y: 0.5, tMs: 1_700_000_000_000 },
  { id: 'vehicle-2', x: 5.0, y: 5.0, tMs: 1_700_000_000_000 },
])
```

### Event types

All events are a discriminated union on `kind`:

```typescript
type GeoEvent =
  | { kind: 'enter';              id: string; geofence: string;      t_ms: number }
  | { kind: 'exit';               id: string; geofence: string;      t_ms: number }
  | { kind: 'enter_corridor';     id: string; corridor: string;      t_ms: number }
  | { kind: 'exit_corridor';      id: string; corridor: string;      t_ms: number }
  | { kind: 'approach';           id: string; zone: string;          t_ms: number }
  | { kind: 'recede';             id: string; zone: string;          t_ms: number }
  | { kind: 'assignment_changed'; id: string; region: string | null; t_ms: number }
```

Switch exhaustively on `kind` to handle each event type.

### Examples

Working examples are in [`examples/typescript/`](examples/typescript/):

| File | What it shows |
|------|---------------|
| [`01-basic-geofence.ts`](examples/typescript/01-basic-geofence.ts) | Register a polygon, ingest points, observe enter/exit events |
| [`02-multi-zone.ts`](examples/typescript/02-multi-zone.ts) | All four zone types — geofence, corridor, catalog, radius — in one script |
| [`03-dwell.ts`](examples/typescript/03-dwell.ts) | Dwell thresholds to debounce boundary hover |

Run the examples after building the native module:

```bash
make napi-build

cd examples/typescript
npm install
npx ts-node 01-basic-geofence.ts
```

---

## CLI

The `geo-stream` binary reads **newline-delimited JSON** from stdin and writes events to stdout (errors to stderr).

```bash
cargo run -p cli --bin geo-stream -- < examples/sample-input.ndjson
```

Expected output:

```json
{"event":"enter","id":"c1","geofence":"zone-1","t":1700000000000}
{"event":"exit","id":"c1","geofence":"zone-1","t":1700000060000}
```

**Input shapes (quick reference):**

- Register a geofence: `{"type":"register_geofence","id":"zone-1","polygon":{...GeoJSON Polygon...}}`
- Point update: `{"type":"update","id":"c1","location":[x,y],"t":1700000000000}`

Full protocol spec: [protocol/ndjson.md](protocol/ndjson.md). A sample with all zone types: [`examples/sample-zones.ndjson`](examples/sample-zones.ndjson).

**Batching:**

```bash
cargo run -p cli --bin geo-stream -- --batch-size 0 < examples/sample-input.ndjson
```

- `--batch-size 1` (default): one `update` line → one engine batch.
- `--batch-size N` (`N > 1`): buffer `N` updates, then `process_batch`.
- `--batch-size 0`: buffer all until EOF, then one `process_batch`.

Zone registrations are always applied immediately.

---

## HTTP adapter

Build the Axum-based HTTP server (same engine, JSON over HTTP):

```bash
cargo build -p cli --features http --bin geo-stream-http
./target/debug/geo-stream-http --listen 0.0.0.0:8080
```

- `GET /health` — `{"status":"ok"}`
- `GET /openapi.json` — OpenAPI 3 spec for all routes
- `POST /v1/register_geofence`, `POST /v1/register_corridor`, `POST /v1/register_catalog_region`, `POST /v1/register_radius`
- `POST /v1/ingest` — body: `{"updates":[...]}`

Errors return `{"error":{"code":"<stable_code>","message":"..."}}` with an appropriate HTTP status.

Set `RUST_LOG=info` for HTTP request tracing.

---

## Rust

The engine is a Cargo workspace of focused crates. Embed it directly:

```rust
use engine::{Engine, GeoEngine};
use state::PointUpdate;

let mut engine = Engine::default();
engine.register_geofence("zone-1", polygon)?;

let events = engine.process_event(PointUpdate {
    id: "c1".into(),
    x: 0.5,
    y: 0.5,
    t_ms: 1_700_000_000_000,
});
```

Build and test:

```bash
cargo build
cargo test
cargo bench -p engine    # Criterion benchmarks → target/criterion/
```

---

## Building the native module

```bash
make napi-build           # debug build (fast iteration)
make napi-build-release   # optimised release build
```

Pre-built `.node` binaries are included for macOS arm64. Release builds for all supported platforms (macOS x64/arm64, Linux x64/arm64, Windows x64) are produced by CI.

---

## Project layout

| Path | Role |
|------|------|
| `crates/adapters/napi` | **TypeScript / Node.js NAPI bindings** |
| `crates/engine` | `GeoEngine` trait, `Engine`, `process_event`, `SpatialRule` pipeline |
| `crates/spatial` | Point-in-polygon, `SpatialIndex`, R-tree (`NaiveSpatialIndex`) |
| `crates/state` | `EntityState`, spatial event types |
| `crates/adapters/stdin-stdout` | NDJSON CLI adapter |
| `crates/adapters/http` | Optional Axum HTTP adapter |
| `crates/cli` | `geo-stream` / `geo-stream-http` binaries |
| `protocol/` | NDJSON wire spec and JSON Schema |
| `examples/` | Sample NDJSON, GeoJSON, and TypeScript scripts |

Background, architectural decisions, and planned features: [ROADMAP.md](ROADMAP.md).

---

## Docker

```bash
docker build -f docker/Dockerfile -t geo-stream .
docker run --rm -i geo-stream < examples/sample-input.ndjson
```

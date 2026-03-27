/**
 * 01-basic-geofence.ts
 *
 * Register a single polygon geofence and process a sequence of point updates.
 * Demonstrates the core enter / exit lifecycle.
 *
 * Prerequisites:
 *   make napi-build          # build the native .node module
 *   npm install              # install ts-node (from this directory)
 *
 * Run:
 *   npx ts-node 01-basic-geofence.ts
 */

import { GeoEngine } from '../../crates/adapters/napi/types'

const engine = new GeoEngine()

// Register a square geofence — coordinates are (x, y) in your chosen unit
// (degrees, metres, etc.; the engine is unit-agnostic).
engine.registerGeofence('city-centre', {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0], // close the ring
    ],
  ],
})

const baseMs = 1_700_000_000_000 // fixed timestamp so output is deterministic

// --- Step 1: entity enters the geofence ---
const enterEvents = engine.ingest([
  { id: 'vehicle-1', x: 0.5, y: 0.5, tMs: baseMs },
])

console.log('After moving inside the geofence:')
for (const ev of enterEvents) {
  console.log(ev)
}
// { kind: 'enter', id: 'vehicle-1', geofence: 'city-centre', t_ms: 1700000000000 }

// --- Step 2: entity exits the geofence ---
const exitEvents = engine.ingest([
  { id: 'vehicle-1', x: 5.0, y: 5.0, tMs: baseMs + 60_000 },
])

console.log('\nAfter moving outside the geofence:')
for (const ev of exitEvents) {
  console.log(ev)
}
// { kind: 'exit', id: 'vehicle-1', geofence: 'city-centre', t_ms: 1700000060000 }

// --- Step 3: second entity — no overlap with step 1 state ---
const otherEvents = engine.ingest([
  { id: 'vehicle-2', x: 0.2, y: 0.8, tMs: baseMs + 120_000 },
])

console.log('\nA second entity entering (independent state):')
for (const ev of otherEvents) {
  console.log(ev)
}
// { kind: 'enter', id: 'vehicle-2', geofence: 'city-centre', t_ms: 1700000120000 }

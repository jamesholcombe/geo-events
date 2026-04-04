# CLAUDE.md

Working reference for this repository. See [ROADMAP.md](ROADMAP.md) for current status.

## Invariants (obey on every change)

1. **Engine owns logic** — no IO, no protocol types inside `crates/engine`
2. **Adapters are thin** — parse/serialize only; no spatial logic or business rules
3. **Event-first** — `process_event` is primary; `process_batch` is a thin wrapper
4. **Spatial is pluggable** — use `SpatialRule` trait, never `match rule_type { Zone => ... }`
5. **State is explicit** — `(old_state, event) → (new_state, outputs)`; no hidden cross-module mutation
6. **Errors** — `Result<T, E>` in core paths; no panics in engine/state/spatial

---

## Build and test commands

```bash
cargo build                          # debug build
cargo test                           # all workspace tests
cargo test -p cli                    # NDJSON integration tests
cargo bench -p engine                # Criterion benchmarks (output: target/criterion/)
cargo fmt --all                      # format
cargo clippy --workspace --all-targets -- -D warnings   # lint (CI enforces -D warnings)
make run                             # pipe examples/sample-input.ndjson through CLI
make docker-build                    # multi-stage Docker image
```

CI runs: `fmt`, `clippy -D warnings`, `cargo test`, JSON Schema validation of example files.

---

## Testing expectations

- Unit tests in `crates/engine` and `crates/state`
- Integration tests: `crates/cli/tests/fixtures/*.ndjson`
- Examples: `examples/sample-*.ndjson`
- Determinism: same inputs → same outputs always

---

## Anti-patterns

- Mixing engine logic with adapter code
- Hardcoding spatial behaviour via large `match` trees in core
- Designing around batch as the primary model
- Implicit or shared mutable state
- Leaking protocol types into the engine

## Guidelines 

- When making updates to code, consider whether you need to make docs updates.
- Primarily this will be within `docs-site`. Use the docs skill if it exists.




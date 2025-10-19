# elm-to-react

**A source-to-source transpiler** that converts **Elm** projects into **TypeScript/React** code, preserving The Elm Architecture (TEA) via a tiny, vendored **redux-loop–style** runtime.

---

## Objective / Why this exists

Elm is a beautiful language and framework with strong guarantees. But today it has a smaller community, limited core development/tooling velocity, and—on large apps with rich interactive components—can feel boilerplate-heavy and slow to ship. Cross-cutting concerns (e.g., consistent querying/caching) are also hard to keep uniform across an Elm codebase.

**elm-to-react** lets you **“eject”** an Elm project into **React/TypeScript**, keeping the good parts (TEA structure, decoders, routing) while gaining the wider JS ecosystem.

**Behavior parity is the #1 goal.** The transpiled React/TypeScript app should behave _exactly_ like the original Elm app. We transpile all reachable Elm dependencies and reuse core Elm semantics wherever possible (including mirroring Elm’s `Cmd`/`Sub` behavior), so you can later refactor incrementally into your preferred React/TS architecture.

The emitted code is intentionally **readable and maintainable**—even if it looks non-idiomatic for typical React/TS apps—so teams can safely understand, test, and gradually reshape it.

---

## What it is

A **source-to-source transpiler** that converts Elm modules into **TypeScript/React** files and runs them on Redux with a tiny, vendored **redux-loop–style** effect system (close to Elm’s `Cmd`/`Sub` model).

---

## Design decisions

### High-level

- **It is a transpiler** (source-to-source compiler), not a new Elm runtime.
- **Name:** `elm-to-react`
- **Output target:** **TypeScript + React** using Redux and a **vendored, inlined redux-loop** (closest parallel to Elm TEA).
- **Platform:** **Node.js** with **node-tree-sitter** for parsing.

### Parsing & Types

- **Grammar:** `tree-sitter-elm` (aka elm-treesitter).
- **Bindings:** `node-tree-sitter` (native addon).
- **Typed CST:** generated with **`dts-tree-sitter`** from `node-types.json` for type-safe visitors.

### Code generation style

- **Uncurried functions by default.**
  `f : A -> B -> C` → `function f(a: A, b: B): C`
- **Partial application:** only synthesize lambdas when Elm actually uses them (eta-expansion).
- **Pipes (`|>`):**
  `a |> f x y` → `pipe(a, v => f(x, y, v))`
- **Case expressions:** compiled to a pattern-matching library.

### Matching & piping libraries

- **Default:** `ts-pattern` for matching **and** `remeda` for `pipe/flow`.
- **Alternative:** `effect/Match` and `effect/Function` if you prefer Effect’s FP utilities.

_(Either way, pipelines are emitted as unary lambdas so switching backends is trivial.)_

### Sum types

- **Representation:** tuple unions
  `['Variant', param1, …] | ['Other', …]`
- Emit constructors (returning `as const`) and optional type guards.
- Rationale: compact, great with `ts-pattern`, and narrows well even with plain `switch (m[0])`.

### Html → JSX

- Elm `Html.*` nodes map **directly** to JSX elements.
- Attribute/event mapping (e.g., `class`→`className`, `for`→`htmlFor`, controlled inputs).
- **Web components** pass through unchanged.

### TEA: `update`, `Cmd`, `Sub`, ports

- `update : Msg -> Model -> (Model, Cmd Msg)` → TS function returning `[model, cmd]`.
- **Effects (`Cmd`)**: executed by the vendored **redux-loop–style enhancer**.
- **Subscriptions (`Sub`)**: treated like **side-effect producers** that call Redux `dispatch` (conceptually the same execution lane as `Cmd`), diffed by keys.
- **Ports**: **direct calls** into your existing TypeScript (redux-loop handlers or sagas). No reinvention.

### JSON & routing

- **JSON:** Keep Elm semantics. We **transpile Elm `Json.Decode`/`Json.Encode` code**; provide tiny TS shims only where necessary to match Elm behavior and error shapes.
- **Routing:** Bring across **Elm routing as is** (`Url.Parser` style).
  Next step (optional): adapters that emit **Next.js App Router** routes or **TanStack Router** config (Vite).

### Dependencies

- **Transpile all reachable Elm dependencies**, including the parts of the **Elm standard library** your project uses.
- For functionality **not implemented in Elm but in native/JS**, use the Elm source as reference and provide minimal TS shims with the same public API.

### Developer experience

- Deterministic output (Prettier), stable name mangling (e.g., `'` → `_`).
- Strict TypeScript (no implicit `any`).
- Source maps planned.

### Non-goals (initially)

- Full stdlib re-implementation (only what your code/deps use).
- Global TCO; add trampolines selectively if/where needed.
- Immediate router “ejection” (Next/TanStack adapters are a later step).

---

## How it works (pipeline)

1. **Parse Elm** with `node-tree-sitter` + `tree-sitter-elm`.
2. **CST access** is strongly typed via `dts-tree-sitter`-generated declarations.
3. **Visitors** walk the CST and build a minimal IR (or directly emit).
4. **Emit TS/TSX**:
   - **Uncurried** functions by default; partials become lambdas.
   - `case` → `ts-pattern` (or `effect/Match`).
   - `|>` → `pipe(base, v => step(v))` (`remeda` or `effect/Function`).
   - Html → JSX; events dispatch `Msg` constructors.
   - TEA wires (`update`/`Cmd`/`Sub`/ports) target the inlined redux-loop enhancer.

5. **Runtime**: A tiny **redux-loop–style** TS module runs effects/subscriptions; your app renders React nodes from the emitted `view(model, dispatch)`.

---

## Configuration

`elm-to-react.config.json`

```json
{
  "entry": ["src/Main.elm"],
  "elmProject": "./elm.json",
  "outDir": "./gen",

  "matchLib": "ts-pattern", // "ts-pattern" | "effect"
  "pipeLib": "remeda", // "remeda" | "effect"

  "sumRepresentation": "tuple",
  "emitSourceMaps": true
}
```

- Set `matchLib="ts-pattern"` and `pipeLib="remeda"` for the default experience.
- Use `"effect"` for one or both if you want Effect’s matcher and pipe/flow.

---

## Mapping rules (cheatsheet)

- **Type aliases**
  `type alias R = { a : Int, b : String }`
  → `type R = { a: number; b: string }`

- **Unions**
  `type Msg = Inc | Set Int`
  →

  ```ts
  export type Msg = ["Inc"] | ["Set", number];
  export const Inc = () => ["Inc"] as const;
  export const Set = (n: number) => ["Set", n] as const;
  ```

- **Functions (uncurried)**
  `add x y = x + y`
  →

  ```ts
  export function add(x: number, y: number) {
    return x + y;
  }
  ```

- **Partial application (eta-expand)**
  `inc = add 1`
  → `export const inc = (y: number) => add(1, y);`

- **Pipelines**
  `a |> f x y |> g q r`
  →

  ```ts
  pipe(
    a,
    v => f(x, y, v),
    v => g(q, r, v)
  );
  ```

- **Records**
  `{ r | x = y, z = w }`
  → `{ ...r, x: y, z: w }`

- **Lists / Maybe / Result**
  `List a` → `a[]` (+ **uncurried, value-last** helpers like `List.map(fn, xs)`),
  `Maybe a` → `['Just', a] | ['Nothing']`,
  `Result e a` → `['Ok', a] | ['Err', e]`

- **`case`**
  With `ts-pattern`:

  ```ts
  match(msg)
    .with(['Set', P.number], ([, n]) => /* ... */)
    .with(['Inc'], () => /* ... */)
    .exhaustive();
  ```

- **Html → JSX**
  - Map elements 1:1; use an attribute/event table for `class`→`className`, `for`→`htmlFor`, booleans, controlled inputs, etc.
  - Event handlers dispatch message constructors: `onClick={() => dispatch(Clicked())}`.
  - Web components pass through unchanged.

- **TEA**
  - `update` returns `[model, cmd]`.
  - `Cmd`: `none`, `batch`, `dispatch`, `delay`, `run`.
  - `Sub`: keyed side-effects that return cancel functions; executed like `Cmd`.
  - Ports: direct calls into your existing TS side-effect layer (redux-loop or saga).

- **JSON & Routing**
  - Transpile Elm `Json.Decode`/`Json.Encode` modules; provide tiny TS shims only as needed.
  - Keep Elm `Url.Parser` routing; adapters to Next/TanStack come later.

---

## Behavior parity & testing

- **Parity contract:** the transpiled app should match the Elm app’s behavior for state transitions, effects, subscriptions, decoders, routing, and DOM interactions.
- **Tests:**
  - **Golden tests**: snapshot emitted TS/TSX for representative Elm inputs (stable printer).
  - **Decoder parity**: run the same JSON through Elm and TS; compare `Ok/Err` structure.
  - **Pure functions**: property tests (e.g., fast-check) against Elm outputs.
  - **E2E**: Playwright/Cypress flows on Elm build vs transpiled React build (clicks, forms, key DOM assertions).

---

## Repository layout (proposed)

```
elm-to-react/
  packages/
    transpiler/
      src/
        cli.ts
        index.ts
        parser/
        visitors/
        emit/
        mapping/            # attrs/events/operators tables, name mangler
        cst-types/          # generated d.ts from dts-tree-sitter
      package.json
    runtime/
      src/
        loop.ts             # Loop types + Cmd constructors
        loopEnhancer.ts     # Redux enhancer/effect runner
        subscriptions.ts    # keyed Sub diff/runner
        core/               # minimal shims used by emitted code
          List.ts
          Maybe.ts
          Result.ts
          Json/Decode.ts
          Json/Encode.ts
          Url/Parser.ts
      package.json
    examples/
      elm/                  # small Elm apps (ground truth)
      react-out/            # generated output for diff tests
  scripts/
    build-elm-parser.ts     # builds node-tree-sitter grammar; emits node-types.json
    gen-cst-types.ts        # runs dts-tree-sitter -> cst-types/*.d.ts
  package.json
  pnpm-workspace.yaml
  README.md
  LICENSE
```

---

## Prerequisites

- **Nix with flakes enabled** (optional, for reproducible dev environment)
- OR **Node.js 24+** and **Yarn 4+**

## Quickstart (dev)

### Using Nix (Recommended)

```bash
# Enter the development environment (provides Node.js 24 + Yarn 4)
nix develop

# Install dependencies
yarn install

# Generate TypeScript definitions for Elm CST
yarn gen:cst-types

# Transpile an Elm file (outputs .ts file next to source by default)
elm-to-react --entry examples/Simple.elm

# Transpile with custom output path
elm-to-react --entry examples/Simple.elm --output dist/Simple.ts

# View detailed AST debug output
elm-to-react --entry examples/Simple.elm --debug
```

### Without Nix

```bash
# Install dependencies (requires Node.js 24+ and Yarn 4+ installed)
yarn install

# Generate TypeScript definitions for Elm CST
yarn gen:cst-types

# Run the CLI in development mode
yarn dev --entry examples/Simple.elm

# With custom output
yarn dev --entry examples/Simple.elm --output dist/Simple.ts
```

---

## CLI Options

```bash
elm-to-react --entry <file> [--output <file>] [--debug]
```

- `--entry <file>`: Entry point Elm file to transpile (required)
- `--output <file>`: Output TypeScript file path (optional, defaults to `<entry>.ts`)
- `--debug`: Show detailed AST debug output (optional)

**Examples in `examples/` folder:**
- `examples/Simple.elm` - A basic counter with TEA pattern
- `examples/Simple.ts` - Generated TypeScript output (self-documenting)

---

## Current Status

The transpiler currently supports:

✅ **Type Declarations** - Sum types with array tuple syntax
```elm
type Msg = Increment | Decrement
```
↓
```typescript
export type Msg = ["Increment"] | ["Decrement"];
```

✅ **Type Aliases** - Records with Elm to TS type conversion
```elm
type alias Model = { count : Int }
```
↓
```typescript
export type Model = { count : number };
```

✅ **Functions** - Arrow functions with parameters
```elm
update : Msg -> Model -> Model
update msg model = ...
```
↓
```typescript
export const update = (msg, model) => ...;
```

✅ **Case Expressions** - Pattern matching on sum types
```elm
case msg of
    Increment -> { model | count = model.count + 1 }
    Decrement -> { model | count = model.count - 1 }
```
↓
```typescript
(() => {
    if (msg[0] === "Increment") return { ...model, count: model.count + 1 };
    if (msg[0] === "Decrement") return { ...model, count: model.count - 1 };
    throw new Error("Non-exhaustive pattern match");
})()
```

✅ **Record Updates** - Spread syntax
```elm
{ model | count = model.count + 1 }
```
↓
```typescript
{ ...model, count: model.count + 1 }
```

✅ **Operators** - String concatenation, arithmetic, field access
```elm
"Count: " ++ String.fromInt model.count
```
↓
```typescript
"Count: " + String.fromInt(model.count)
```

✅ **Function Calls** - Elm application to TS call syntax
```elm
Html.div [] [ Html.text "hello" ]
```
↓
```typescript
Html.div([], [Html.text("hello")])
```

---

## Development Commands

```bash
# Generate TypeScript definitions for Elm CST
yarn gen:cst-types

# Run the transpiler (development mode, uses Node's native TS support)
yarn dev --entry <path-to-elm-file>

# Build for production
yarn build

# Type check without emitting
yarn typecheck

# Lint
yarn lint

# Format code
yarn format
```

---

## Roadmap (first steps)

1. **Bootstrap & parser toolchain**: Node + `node-tree-sitter`, generate `node-types.json` and CST `.d.ts` with `dts-tree-sitter`. Add a CST inspector CLI.
2. **Core emitter**: literals/idents/records/functions (uncurried), pipes, operators; stable printer.
3. **Case → matcher**: implement with `ts-pattern` (or `effect/Match`), enforce exhaustiveness.
4. **TEA runtime**: inline redux-loop enhancer, `Cmd` variants, keyed `Sub` runner, ports wiring.
5. **Html → JSX**: attributes/events/controlled inputs + render bridge.
6. **JSON & routing**: transpile Elm modules; provide minimal TS shims where necessary; parity tests vs Elm.
7. **Module graph & deps**: read `elm.json`, transpile reachable packages; minimal kernel/JS shims.

---

## Notes & constraints

- We **transpile** your Elm dependencies (reachable modules) and ship small TS shims **only** where Elm relied on kernel/native behaviors.
- Ports remain **your** TS code; the transpiler just wires to them.
- We target **strict TS** types and **deterministic** output to make diffs meaningful.
- Router “ejection” to Next/TanStack is **optional** and comes later as a codegen adapter.

---

If you’d like this split into `README.md` + `CONTRIBUTING.md` and a seeded GitHub issues backlog, say the word and I’ll format them for copy-paste.

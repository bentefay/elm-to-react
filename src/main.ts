#!/usr/bin/env node

import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";

const cli = Command.make("transpile", {
  entry: Options.file("entry").pipe(
    Options.withDescription("Entry point Elm file(s) to transpile")
  ),
  elmProject: Options.file("elm-project").pipe(
    Options.withDefault("./elm.json"),
    Options.withDescription("Path to elm.json")
  ),
  outDir: Options.directory("out").pipe(
    Options.withDefault("./gen"),
    Options.withDescription("Output directory for generated TypeScript")
  ),
})
  .pipe(
    Command.withHandler(({ entry, elmProject, outDir }) =>
      Effect.gen(function* () {
        yield* Console.log("🌳 elm-to-react transpiler");
        yield* Console.log("");
        yield* Console.log(`Entry: ${entry}`);
        yield* Console.log(`Elm project: ${elmProject}`);
        yield* Console.log(`Output directory: ${outDir}`);
        yield* Console.log("");
        yield* Console.log("⚠️  Transpilation not yet implemented");

        // TODO: Implement transpilation
        // 1. Parse entry file with tree-sitter
        // 2. Walk CST and emit TypeScript
        // 3. Write to output directory
      })
    )
  )
  .pipe(
    Command.withDescription(
      "A source-to-source transpiler from Elm to TypeScript/React"
    )
  );

const run = Command.run(cli, {
  name: "elm-to-react",
  version: "0.1.0",
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);

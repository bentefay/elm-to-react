#!/usr/bin/env node

import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option } from "effect";
import { createParser } from "./parser/index.ts";
import { createEmitter } from "./emitter/index.ts";

const cli = Command.make("transpile", {
  entry: Options.file("entry").pipe(
    Options.withDescription("Entry point Elm file(s) to transpile")
  ),
  output: Options.file("output").pipe(
    Options.withDescription(
      "Output file path (defaults to <entry-file>.ts next to the source)"
    ),
    Options.optional
  ),
  debug: Options.boolean("debug").pipe(
    Options.withDescription("Show detailed AST debug output"),
    Options.withDefault(false)
  ),
})
  .pipe(
    Command.withDescription(
      "A source-to-source transpiler from Elm to TypeScript/React"
    )
  )
  .pipe(
    Command.withHandler(({ entry, output, debug }) =>
      Effect.gen(function* () {
        yield* Console.log("🌳 elm-to-react transpiler\n");
        yield* Console.log(`Entry: ${entry}\n`);

        // Parse the Elm file
        const parser = createParser();
        const source = yield* Effect.promise(() =>
          import("node:fs/promises").then(fs => fs.readFile(entry, "utf-8"))
        );
        const tree = parser.parse(source);
        const root = parser.getRoot(tree);

        yield* Console.log("✅ Successfully parsed Elm file!\n");

        if (debug) {
          yield* Console.log("🔍 AST Debug View:");
          yield* Console.log(
            "─".repeat(80) +
              "\n" +
              parser.printDetailedTree(tree, source) +
              "\n"
          );
        }

        // Generate TypeScript
        const emitter = createEmitter();
        const typescript = emitter.emit(root, source);

        // Determine output path - unwrap Option type from Effect
        const outputPath = Option.isSome(output)
          ? output.value
          : entry.replace(/\.elm$/, ".ts");

        // Write to file
        yield* Effect.promise(() =>
          import("node:fs/promises").then(fs =>
            fs.writeFile(outputPath, typescript, "utf-8")
          )
        );

        yield* Console.log(`✅ Wrote TypeScript to: ${outputPath}\n`);

        yield* Console.log("📄 Generated TypeScript:");
        yield* Console.log("─".repeat(80));
        yield* Console.log(typescript);
        yield* Console.log("─".repeat(80));
      })
    )
  );

const run = Command.run(cli, {
  name: "elm-to-react",
  version: "0.1.0",
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);

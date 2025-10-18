#!/usr/bin/env node

import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { createParser } from "./parser/index.ts";

const cli = Command.make("transpile", {
  entry: Options.file("entry").pipe(
    Options.withDescription("Entry point Elm file(s) to transpile")
  ),
})
  .pipe(
    Command.withDescription(
      "A source-to-source transpiler from Elm to TypeScript/React"
    )
  )
  .pipe(
    Command.withHandler(({ entry }) =>
      Effect.gen(function* () {
        yield* Console.log("🌳 elm-to-react transpiler");
        yield* Console.log("");
        yield* Console.log(`Entry: ${entry}`);
        yield* Console.log("");

        const parser = createParser();

        yield* Effect.tryPromise({
          try: async () => {
            const tree = await parser.parseFile(entry);
            console.log("✅ Successfully parsed Elm file!");
            console.log("");
            console.log("AST preview:");
            console.log(parser.printTree(tree));
            return tree;
          },
          catch: error => new Error(`Failed to parse Elm file: ${error}`),
        });
      })
    )
  );

const run = Command.run(cli, {
  name: "elm-to-react",
  version: "0.1.0",
});

run(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);

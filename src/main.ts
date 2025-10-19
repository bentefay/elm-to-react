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
            const { readFile } = await import("node:fs/promises");
            const source = await readFile(entry, "utf-8");
            const tree = parser.parse(source);
            const root = parser.getRoot(tree);

            console.log("✅ Successfully parsed Elm file!");
            console.log("");

            // Show module declaration if present
            if (root.moduleDeclarationNode) {
              const moduleText = parser.getNodeText(
                root.moduleDeclarationNode,
                source
              );
              console.log("📦 Module:");
              console.log(`   ${moduleText}`);
              console.log("");
            }

            // Show top-level declarations
            const declarations = root.namedChildren.filter(
              child =>
                child.type === "type_declaration" ||
                child.type === "type_alias_declaration" ||
                child.type === "value_declaration"
            );

            if (declarations.length > 0) {
              console.log(
                `📝 Found ${declarations.length} top-level declarations:`
              );
              console.log("");

              for (const decl of declarations) {
                const declText = parser.getNodeText(decl, source);
                const preview = declText.split("\n")[0];
                console.log(
                  `   ${decl.type}: ${preview}${declText.includes("\n") ? "..." : ""}`
                );
              }
              console.log("");
            }

            console.log("🌲 Detailed AST:");
            console.log(parser.printDetailedTree(tree, source));

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

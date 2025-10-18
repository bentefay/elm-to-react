#!/usr/bin/env node
/**
 * Generate TypeScript definitions for the Elm CST from tree-sitter-elm
 * Uses dts-tree-sitter to create type-safe AST node types
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "src", "parser", "cst-types");

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log("🌳 Generating TypeScript definitions for Elm CST...");
console.log(`Output directory: ${outputDir}`);

try {
  execSync(
    `node ./node_modules/@asgerf/dts-tree-sitter/build/src/index.js @elm-tooling/tree-sitter-elm`,
    {
      stdio: "inherit",
      cwd: rootDir,
    }
  );

  console.log("✅ Successfully generated Elm CST types!");
  console.log(`   Check: ${outputDir}/`);
} catch (error) {
  console.error("❌ Failed to generate CST types:", error);
  process.exit(1);
}

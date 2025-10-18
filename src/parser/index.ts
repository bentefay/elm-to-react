import Parser from "tree-sitter";
import ElmLanguage from "@elm-tooling/tree-sitter-elm";
import { readFile } from "node:fs/promises";
import type * as ElmSyntax from "./cst-types/tree-sitter-elm.d.ts";

export class ElmParser {
  private parser: ElmSyntax.Parser;

  constructor() {
    this.parser = new Parser() as ElmSyntax.Parser;
    this.parser.setLanguage(ElmLanguage);
  }

  parse(source: string): ElmSyntax.Tree {
    return this.parser.parse(source);
  }

  async parseFile(filePath: string): Promise<ElmSyntax.Tree> {
    const source = await readFile(filePath, "utf-8");
    return this.parse(source);
  }

  getRoot(tree: ElmSyntax.Tree): ElmSyntax.FileNode {
    return tree.rootNode as ElmSyntax.FileNode;
  }

  printTree(tree: ElmSyntax.Tree): string {
    return tree.rootNode.toString();
  }
}

export function createParser(): ElmParser {
  return new ElmParser();
}

export type { ElmSyntax };

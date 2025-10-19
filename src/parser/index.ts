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

  /**
   * Print a detailed tree view showing node types and their source text
   */
  printDetailedTree(tree: ElmSyntax.Tree, source: string): string {
    const lines: string[] = [];
    const root = tree.rootNode;

    const walk = (node: ElmSyntax.SyntaxNode, depth: number = 0) => {
      const indent = "  ".repeat(depth);
      const nodeText = source.substring(node.startIndex, node.endIndex);
      const preview =
        nodeText.length > 60
          ? nodeText.substring(0, 60).replace(/\n/g, "\\n") + "..."
          : nodeText.replace(/\n/g, "\\n");

      lines.push(
        `${indent}${node.type} [${node.startPosition.row}:${node.startPosition.column}] "${preview}"`
      );

      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i)!, depth + 1);
      }
    };

    walk(root);
    return lines.join("\n");
  }

  /**
   * Get the source text for a node
   */
  getNodeText(node: ElmSyntax.SyntaxNode, source: string): string {
    return source.substring(node.startIndex, node.endIndex);
  }
}

export function createParser(): ElmParser {
  return new ElmParser();
}

export type { ElmSyntax };

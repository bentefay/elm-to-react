/**
 * TypeScript code emitter for Elm AST
 */

import type { ElmSyntax } from "../parser/index.js";

export class TypeScriptEmitter {
  emit(root: ElmSyntax.FileNode, source: string): string {
    const lines: string[] = [];

    if (root.moduleDeclarationNode) {
      const moduleName = this.getModuleName(root.moduleDeclarationNode, source);
      lines.push(`// Generated from Elm module: ${moduleName}`);
      lines.push("");
    }

    const imports = this.emitImports(root, source);
    if (imports) {
      lines.push(imports);
      lines.push("");
    }

    for (const child of root.namedChildren) {
      const emitted = this.emitTopLevelDeclaration(child, source);
      if (emitted) {
        lines.push(emitted);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private getModuleName(
    moduleDecl: ElmSyntax.ModuleDeclarationNode,
    source: string
  ): string {
    const qid = moduleDecl.namedChildren.find(
      child => child.type === "upper_case_qid"
    );
    if (qid) return source.substring(qid.startIndex, qid.endIndex);
    return "Unknown";
  }

  private emitImports(root: ElmSyntax.FileNode, source: string): string {
    const imports: string[] = [];
    for (const child of root.namedChildren) {
      if (child.type === "import_clause") {
        const importText = source.substring(child.startIndex, child.endIndex);
        imports.push(`// ${importText}`);
      }
    }
    return imports.join("\n");
  }

  private emitTopLevelDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string | null {
    switch (node.type) {
      case "type_declaration":
        return this.emitTypeDeclaration(node, source);
      case "type_alias_declaration":
        return this.emitTypeAliasDeclaration(node, source);
      case "value_declaration":
        return this.emitValueDeclaration(node, source);
      default:
        return null;
    }
  }

  private emitTypeDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Find the type name (upper_case_identifier)
    const nameNode = node.namedChildren.find(
      child => child.type === "upper_case_identifier"
    );
    const typeName = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "Unknown";

    // Find union variants
    const unionVariants = node.namedChildren.filter(
      child => child.type === "union_variant"
    );

    if (unionVariants.length === 0) {
      return [
        `// type ${typeName} (no variants found)`,
        `export type ${typeName} = never;`,
      ].join("\n");
    }

    // Extract variant names and convert to array syntax ["VariantName", ...params]
    const variants = unionVariants.map(variant => {
      const variantName = variant.namedChildren.find(
        child => child.type === "upper_case_identifier"
      );
      if (variantName) {
        const name = source.substring(
          variantName.startIndex,
          variantName.endIndex
        );
        // TODO: Extract parameters from union_variant and add them to the array
        // For now, just wrap the name in array syntax
        return `["${name}"]`;
      }
      return '["Unknown"]';
    });

    return [
      `// type ${typeName}`,
      `export type ${typeName} = ${variants.join(" | ")};`,
    ].join("\n");
  }

  private emitTypeAliasDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Find the type name
    const nameNode = node.namedChildren.find(
      child => child.type === "upper_case_identifier"
    );
    const typeName = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "Unknown";

    // Find the type_expression node (it contains the actual type)
    const typeExpr = node.namedChildren.find(
      child => child.type === "type_expression"
    );

    if (!typeExpr) {
      return [
        `// type alias ${typeName} (no type expression found)`,
        `export type ${typeName} = any;`,
      ].join("\n");
    }

    // Get the raw type text and convert Elm syntax to TypeScript
    const typeText = source
      .substring(typeExpr.startIndex, typeExpr.endIndex)
      .trim();
    const tsType = this.convertElmTypeToTS(typeText);

    return [
      `// type alias ${typeName}`,
      `export type ${typeName} = ${tsType};`,
    ].join("\n");
  }

  private convertElmTypeToTS(elmType: string): string {
    // Convert Elm record field syntax `field : Type` to TS (keep as-is mostly)
    // Convert basic types
    return elmType
      .replace(/Int\b/g, "number")
      .replace(/Float\b/g, "number")
      .replace(/String\b/g, "string")
      .replace(/Bool\b/g, "boolean")
      .replace(/Html\s+\w+/g, "JSX.Element");
  }

  private emitValueDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Find the function_declaration_left (has the name and parameters)
    const leftNode = node.namedChildren.find(
      child => child.type === "function_declaration_left"
    );

    if (!leftNode) {
      return [
        `// value (no function_declaration_left found)`,
        `export const unknown: any = null;`,
      ].join("\n");
    }

    // Get the function name
    const nameNode = leftNode.namedChildren.find(
      child => child.type === "lower_case_identifier"
    );
    const name = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "unknown";

    // Find the preceding type_annotation sibling (it's a sibling in file.namedChildren, not a child of value_declaration)
    // For now, we'll just look for it in the parent scope if needed
    let tsType = "";

    // Check if there are parameters (patterns after the name)
    const params = leftNode.namedChildren.filter(
      child => child.type === "pattern" || child.type.includes("pattern")
    );

    // Get the body - it's the non-eq namedChild after the left side
    const bodyNode = node.namedChildren.find(
      child =>
        child !== leftNode &&
        child.type !== "eq" &&
        child.type !== "type_annotation"
    );

    if (!bodyNode) {
      return [
        `// value ${name} (no body found)`,
        `export const ${name}${tsType} = null as any;`,
      ].join("\n");
    }

    // Get body text
    let body = source.substring(bodyNode.startIndex, bodyNode.endIndex).trim();

    // If it's a simple value (no params), try to convert simple cases
    if (params.length === 0) {
      // Simple heuristic: if it's a record expression, convert `=` to `:`
      if (bodyNode.type === "record_expr") {
        body = body.replace(/(\w+)\s*=\s*/g, "$1: ");
      }
      // If it's a function call or other expression, keep as-is for now
      return [
        `// value ${name}`,
        `export const ${name}${tsType} = ${body};`,
      ].join("\n");
    }

    // It's a function with parameters - stub it for now
    return [
      `// function ${name} (${params.length} params)`,
      `export const ${name}${tsType} = null as any; // TODO: Implement function`,
    ].join("\n");
  }
}

export function createEmitter(): TypeScriptEmitter {
  return new TypeScriptEmitter();
}

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

    // Check if there are parameters (patterns after the name)
    const paramPatterns = leftNode.namedChildren.filter(
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
        `export const ${name} = null as any;`,
      ].join("\n");
    }

    // If it's a simple value (no params), try to convert simple cases
    if (paramPatterns.length === 0) {
      // Simple heuristic: if it's a record expression, convert `=` to `:`
      if (bodyNode.type === "record_expr") {
        const body = source
          .substring(bodyNode.startIndex, bodyNode.endIndex)
          .trim()
          .replace(/(\w+)\s*=\s*/g, "$1: ");
        return [`// value ${name}`, `export const ${name} = ${body};`].join(
          "\n"
        );
      }
      // If it's a function call or other expression, convert it
      const body = this.emitExpression(bodyNode, source);
      return [`// value ${name}`, `export const ${name} = ${body};`].join("\n");
    }

    // It's a function with parameters - generate arrow function
    const params = paramPatterns
      .map(pattern => this.emitPattern(pattern, source))
      .join(", ");
    const body = this.emitExpression(bodyNode, source);

    return [
      `// function ${name}`,
      `export const ${name} = (${params}) => ${body};`,
    ].join("\n");
  }

  private emitPattern(node: ElmSyntax.SyntaxNode, source: string): string {
    // For now, just extract the pattern text
    // TODO: Handle complex patterns (destructuring, etc.)
    if (node.type === "lower_pattern") {
      const identifier = node.namedChildren.find(
        child => child.type === "lower_case_identifier"
      );
      if (identifier) {
        return source.substring(identifier.startIndex, identifier.endIndex);
      }
    }
    // Fallback to raw text
    return source.substring(node.startIndex, node.endIndex);
  }

  private emitExpression(node: ElmSyntax.SyntaxNode, source: string): string {
    switch (node.type) {
      case "record_expr":
        return this.emitRecordExpression(node, source);
      case "case_of_expr":
        return this.emitCaseExpression(node, source);
      case "function_call_expr":
        return this.emitFunctionCall(node, source);
      case "value_expr":
        return this.emitValueExpression(node, source);
      case "field_access_expr":
        return this.emitFieldAccess(node, source);
      case "bin_op_expr":
        return this.emitBinaryOp(node, source);
      case "parenthesized_expr":
        return this.emitParenthesizedExpression(node, source);
      case "list_expr":
        return this.emitListExpression(node, source);
      case "string_constant_expr":
      case "number_constant_expr":
        return source.substring(node.startIndex, node.endIndex);
      default:
        // Fallback: return raw source for now
        return source.substring(node.startIndex, node.endIndex);
    }
  }

  private emitParenthesizedExpression(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Find the inner expression (skip the parentheses)
    const inner = node.namedChildren.find(
      child => child.type !== "(" && child.type !== ")"
    );
    if (inner) {
      return `(${this.emitExpression(inner, source)})`;
    }
    return source.substring(node.startIndex, node.endIndex);
  }

  private emitListExpression(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Convert Elm list to TypeScript array
    const elements = node.namedChildren
      .filter(
        child => child.type !== "[" && child.type !== "]" && child.type !== ","
      )
      .map(elem => this.emitExpression(elem, source));

    return `[${elements.join(", ")}]`;
  }

  private emitRecordExpression(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Check if it's a record update `{ model | field = value }`
    const baseId = node.namedChildren.find(
      child => child.type === "record_base_identifier"
    );

    if (baseId) {
      // Record update - convert to spread syntax
      const base = source.substring(baseId.startIndex, baseId.endIndex);
      const fields = node.namedChildren
        .filter(child => child.type === "field")
        .map(field => {
          const fieldName = field.namedChildren.find(
            child => child.type === "lower_case_identifier"
          );
          const value = field.namedChildren.find(
            child =>
              child.type !== "lower_case_identifier" && child.type !== "eq"
          );
          if (fieldName && value) {
            const name = source.substring(
              fieldName.startIndex,
              fieldName.endIndex
            );
            const val = this.emitExpression(value, source);
            return `${name}: ${val}`;
          }
          return "";
        })
        .filter(Boolean);

      return `{ ...${base}, ${fields.join(", ")} }`;
    }

    // Simple record - convert `field = value` to `field: value`
    const text = source.substring(node.startIndex, node.endIndex);
    return text.replace(/(\w+)\s*=\s*/g, "$1: ");
  }

  private emitCaseExpression(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // Find the expression being matched on
    const valueExpr = node.namedChildren.find(
      child =>
        child.type !== "case" &&
        child.type !== "of" &&
        child.type !== "case_of_branch"
    );

    if (!valueExpr) {
      return "(null as any) /* case expression: no value */";
    }

    const matchValue = this.emitExpression(valueExpr, source);

    // Find all branches
    const branches = node.namedChildren.filter(
      child => child.type === "case_of_branch"
    );

    if (branches.length === 0) {
      return "(null as any) /* case expression: no branches */";
    }

    // Convert to a series of ternary expressions or a match statement
    // For now, let's use a simple approach with immediately invoked function
    const branchCode = branches
      .map(branch => {
        const pattern = branch.namedChildren.find(
          child => child.type === "pattern" || child.type.includes("pattern")
        );
        const body = branch.namedChildren.find(
          child =>
            child.type !== "pattern" &&
            !child.type.includes("pattern") &&
            child.type !== "arrow"
        );

        if (!pattern || !body) return "";

        const patternStr = this.emitCasePattern(pattern, source);
        const bodyStr = this.emitExpression(body, source);

        return `    if (${matchValue}[0] === "${patternStr}") return ${bodyStr};`;
      })
      .filter(Boolean)
      .join("\n");

    return `(() => {\n${branchCode}\n    throw new Error("Non-exhaustive pattern match");\n  })()`;
  }

  private emitCasePattern(node: ElmSyntax.SyntaxNode, source: string): string {
    // Handle union patterns (e.g., Increment, Decrement)
    if (node.type === "union_pattern") {
      const qid = node.namedChildren.find(
        child => child.type === "upper_case_qid"
      );
      if (qid) {
        const identifier = qid.namedChildren.find(
          child => child.type === "upper_case_identifier"
        );
        if (identifier) {
          return source.substring(identifier.startIndex, identifier.endIndex);
        }
      }
    }
    // Fallback
    return source.substring(node.startIndex, node.endIndex);
  }

  private emitFunctionCall(node: ElmSyntax.SyntaxNode, source: string): string {
    // Get all children to build the call
    const children = node.namedChildren;
    if (children.length === 0) {
      return source.substring(node.startIndex, node.endIndex);
    }

    // First child is the function expression
    const func = this.emitExpression(children[0], source);

    // Rest are arguments
    const args = children
      .slice(1)
      .map(arg => this.emitExpression(arg, source))
      .join(", ");

    return args ? `${func}(${args})` : func;
  }

  private emitValueExpression(
    node: ElmSyntax.SyntaxNode,
    source: string
  ): string {
    // value_qid contains the identifier(s)
    const qid = node.namedChildren.find(child => child.type === "value_qid");
    if (qid) {
      return source.substring(qid.startIndex, qid.endIndex);
    }
    return source.substring(node.startIndex, node.endIndex);
  }

  private emitFieldAccess(node: ElmSyntax.SyntaxNode, source: string): string {
    // Field access is already in the right syntax for TS (e.g., model.count)
    return source.substring(node.startIndex, node.endIndex);
  }

  private emitBinaryOp(node: ElmSyntax.SyntaxNode, source: string): string {
    const children = node.namedChildren;
    if (children.length < 3) {
      return source.substring(node.startIndex, node.endIndex);
    }

    const left = this.emitExpression(children[0], source);
    const op = source.substring(children[1].startIndex, children[1].endIndex);
    const right = this.emitExpression(children[2], source);

    // Convert Elm operators to TS
    const tsOp = op === "++" ? "+" : op;

    return `${left} ${tsOp} ${right}`;
  }
}

export function createEmitter(): TypeScriptEmitter {
  return new TypeScriptEmitter();
}

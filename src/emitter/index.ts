/**
 * TypeScript code emitter for Elm AST
 */

import type { ElmSyntax } from "../parser/index.js";

export class TypeScriptEmitter {
  emit(root: ElmSyntax.FileNode, source: string): string {
    console.log("TypeScriptEmitter.emit called");
    const lines: string[] = [];

    // Extract the exposing list from module declaration
    const exposedNames = root.moduleDeclarationNode
      ? this.getExposedNames(root.moduleDeclarationNode, source)
      : new Set<string>();

    // Collect type annotations (they appear as siblings before value declarations)
    const typeAnnotations = this.collectTypeAnnotations(root, source);

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
      const emitted = this.emitTopLevelDeclaration(
        child,
        source,
        exposedNames,
        typeAnnotations
      );
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

  private getExposedNames(
    moduleDecl: ElmSyntax.ModuleDeclarationNode,
    source: string
  ): Set<string> {
    const exposedNames = new Set<string>();

    // Find the exposing_list node
    const exposingList = moduleDecl.namedChildren.find(
      child => child.type === "exposing_list"
    );

    if (!exposingList) {
      return exposedNames;
    }

    // Check if it's exposing all (..)
    const hasDoubleDotsExpose = exposingList.namedChildren.some(
      child => child.type === "double_dot"
    );

    if (hasDoubleDotsExpose) {
      // exposing (..) means export everything
      return new Set(["*"]);
    }

    // Otherwise, collect specific exposed items
    for (const child of exposingList.namedChildren) {
      if (child.type === "exposed_value") {
        // exposed_value contains a lower_case_identifier
        const identifier = child.namedChildren.find(
          n => n.type === "lower_case_identifier"
        );
        if (identifier) {
          exposedNames.add(
            source.substring(identifier.startIndex, identifier.endIndex)
          );
        }
      } else if (child.type === "exposed_type") {
        // exposed_type contains an upper_case_identifier and optionally (..)
        const identifier = child.namedChildren.find(
          n => n.type === "upper_case_identifier"
        );
        if (identifier) {
          const typeName = source.substring(
            identifier.startIndex,
            identifier.endIndex
          );
          exposedNames.add(typeName);

          // Check if it's exposing constructors Type(..)
          const hasDoubleDot = child.namedChildren.some(
            n => n.type === "double_dot"
          );
          if (hasDoubleDot) {
            exposedNames.add(`${typeName}:constructors`);
          }
        }
      }
    }

    return exposedNames;
  }

  private collectTypeAnnotations(
    root: ElmSyntax.FileNode,
    source: string
  ): Map<string, string> {
    const annotations = new Map<string, string>();

    for (const child of root.namedChildren) {
      if (child.type === "type_annotation") {
        // Get the name (lower_case_identifier)
        const nameNode = child.namedChildren.find(
          n => n.type === "lower_case_identifier"
        );
        // Get the type expression (after the colon)
        const typeExpr = child.namedChildren.find(
          n => n.type === "type_expression"
        );

        if (nameNode && typeExpr) {
          const name = source.substring(nameNode.startIndex, nameNode.endIndex);
          const typeText = source.substring(
            typeExpr.startIndex,
            typeExpr.endIndex
          );
          annotations.set(name, typeText);
        }
      }
    }

    return annotations;
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
    source: string,
    exposedNames: Set<string>,
    typeAnnotations: Map<string, string>
  ): string | null {
    switch (node.type) {
      case "type_declaration":
        return this.emitTypeDeclaration(node, source, exposedNames);
      case "type_alias_declaration":
        return this.emitTypeAliasDeclaration(node, source, exposedNames);
      case "value_declaration":
        return this.emitValueDeclaration(
          node,
          source,
          exposedNames,
          typeAnnotations
        );
      case "type_annotation":
        // Skip type annotations - they're already collected
        return null;
      default:
        return null;
    }
  }

  private emitTypeDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string,
    exposedNames: Set<string>
  ): string {
    // Find the type name (upper_case_identifier)
    const nameNode = node.namedChildren.find(
      child => child.type === "upper_case_identifier"
    );
    const typeName = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "Unknown";

    // Check if this type should be exported
    const shouldExport = exposedNames.has("*") || exposedNames.has(typeName);
    const exportKeyword = shouldExport ? "export " : "";

    // Find union variants
    const unionVariants = node.namedChildren.filter(
      child => child.type === "union_variant"
    );

    if (unionVariants.length === 0) {
      return [
        `// type ${typeName} (no variants found)`,
        `${exportKeyword}type ${typeName} = never;`,
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
      `${exportKeyword}type ${typeName} = ${variants.join(" | ")};`,
    ].join("\n");
  }

  private emitTypeAliasDeclaration(
    node: ElmSyntax.SyntaxNode,
    source: string,
    exposedNames: Set<string>
  ): string {
    // Find the type name
    const nameNode = node.namedChildren.find(
      child => child.type === "upper_case_identifier"
    );
    const typeName = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "Unknown";

    // Check if this type should be exported
    const shouldExport = exposedNames.has("*") || exposedNames.has(typeName);
    const exportKeyword = shouldExport ? "export " : "";

    // Find the type_expression node (it contains the actual type)
    const typeExpr = node.namedChildren.find(
      child => child.type === "type_expression"
    );

    if (!typeExpr) {
      return [
        `// type alias ${typeName} (no type expression found)`,
        `${exportKeyword}type ${typeName} = any;`,
      ].join("\n");
    }

    // Get the raw type text and convert Elm syntax to TypeScript
    const typeText = source
      .substring(typeExpr.startIndex, typeExpr.endIndex)
      .trim();
    const tsType = this.convertElmTypeToTS(typeText);

    return [
      `// type alias ${typeName}`,
      `${exportKeyword}type ${typeName} = ${tsType};`,
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
    source: string,
    exposedNames: Set<string>,
    typeAnnotations: Map<string, string>
  ): string {
    // Find the function_declaration_left (has the name and parameters)
    const leftNode = node.namedChildren.find(
      child => child.type === "function_declaration_left"
    );

    if (!leftNode) {
      return [
        `// value (no function_declaration_left found)`,
        `const unknown: any = null;`,
      ].join("\n");
    }

    // Get the function name
    const nameNode = leftNode.namedChildren.find(
      child => child.type === "lower_case_identifier"
    );
    const name = nameNode
      ? source.substring(nameNode.startIndex, nameNode.endIndex)
      : "unknown";

    // Check if this value should be exported
    const shouldExport = exposedNames.has("*") || exposedNames.has(name);
    const exportKeyword = shouldExport ? "export " : "";

    // Get type annotation if it exists
    const elmType = typeAnnotations.get(name);

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
      const typeAnnotation = elmType
        ? `: ${this.convertElmTypeToTS(elmType)}`
        : "";
      return [
        `// value ${name} (no body found)`,
        `${exportKeyword}const ${name}${typeAnnotation} = null as any;`,
      ].join("\n");
    }

    // If it's a simple value (no params), try to convert simple cases
    if (paramPatterns.length === 0) {
      const typeAnnotation = elmType
        ? `: ${this.convertElmTypeToTS(elmType)}`
        : "";

      // Emit the body using emitExpression for proper handling of all expression types
      const body = this.emitExpression(bodyNode, source);
      return [
        `// value ${name}`,
        `${exportKeyword}const ${name}${typeAnnotation} = ${body};`,
      ].join("\n");
    }

    // It's a function with parameters - parse the function type
    if (elmType) {
      const { paramTypes, returnType } = this.parseFunctionType(elmType);

      // Annotate parameters with their types
      const params = paramPatterns
        .map((pattern, i) => {
          const paramName = this.emitPattern(pattern, source);
          const paramType = paramTypes[i]
            ? `: ${this.convertElmTypeToTS(paramTypes[i])}`
            : "";
          return `${paramName}${paramType}`;
        })
        .join(", ");

      const body = this.emitExpression(bodyNode, source);
      const returnAnnotation = returnType
        ? `: ${this.convertElmTypeToTS(returnType)}`
        : "";

      return [
        `// function ${name}`,
        `${exportKeyword}const ${name} = (${params})${returnAnnotation} => ${body};`,
      ].join("\n");
    }

    // No type annotation - generate without types
    const params = paramPatterns
      .map(pattern => this.emitPattern(pattern, source))
      .join(", ");
    const body = this.emitExpression(bodyNode, source);

    return [
      `// function ${name}`,
      `${exportKeyword}const ${name} = (${params}) => ${body};`,
    ].join("\n");
  }

  private parseFunctionType(elmType: string): {
    paramTypes: string[];
    returnType: string;
  } {
    // Parse Elm function type: A -> B -> C
    // Last type is return type, rest are parameters
    const parts = elmType.split("->").map(s => s.trim());

    if (parts.length === 1) {
      // Not a function, just a value type
      return { paramTypes: [], returnType: parts[0] };
    }

    const returnType = parts[parts.length - 1];
    const paramTypes = parts.slice(0, -1);

    return { paramTypes, returnType };
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

    // Simple record - properly emit each field value
    const fields = node.namedChildren
      .filter(child => child.type === "field")
      .map(field => {
        const fieldName = field.namedChildren.find(
          child => child.type === "lower_case_identifier"
        );
        const value = field.namedChildren.find(
          child => child.type !== "lower_case_identifier" && child.type !== "eq"
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

    return `{ ${fields.join(", ")} }`;
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
    // value_qid contains the identifier(s) - can be upper_case_qid or lower_case_identifier
    const qid = node.namedChildren.find(child => child.type === "value_qid");
    if (!qid) {
      return source.substring(node.startIndex, node.endIndex);
    }

    const text = source.substring(qid.startIndex, qid.endIndex);

    // Check if it contains an upper_case_qid (sum type constructor)
    const upperCaseQid = qid.namedChildren.find(
      child => child.type === "upper_case_qid"
    );

    if (upperCaseQid) {
      // Get the actual identifier from upper_case_qid
      const upperCaseIdentifier = upperCaseQid.namedChildren.find(
        child => child.type === "upper_case_identifier"
      );

      if (upperCaseIdentifier) {
        const constructorName = source.substring(
          upperCaseIdentifier.startIndex,
          upperCaseIdentifier.endIndex
        );

        console.log(`Found constructor: ${constructorName}`);

        // Special case for Bool constructors
        if (constructorName === "True") {
          return "true";
        }
        if (constructorName === "False") {
          return "false";
        }

        // Other sum type constructors - convert to array syntax
        // TODO: Handle constructors with parameters
        return `["${constructorName}"]`;
      }
    }

    // It's a regular value (lowercase identifier)
    return text;
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

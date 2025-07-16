import ts from "typescript";
import path from "path";

import { METADATA_KEY } from "./constants";

export function transformReactComponentSource(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tagName = node.tagName.getText();

        // Only apply to PascalCase components
        if (/^[a-z]/.test(tagName)) return node;

        const attributes = node.attributes.properties;

        const alreadyHasSource = attributes.some(
          attr =>
            ts.isJsxAttribute(attr) &&
            "text" in attr.name &&
            attr.name.text === METADATA_KEY
        );
        if (alreadyHasSource) return node;

        const sourceFile = node.getSourceFile();
        const { line, character } = ts.getLineAndCharacterOfPosition(
          sourceFile,
          node.getStart()
        );
        const fileName = path.relative(process.cwd(), sourceFile.fileName);

        const sourceProp = ts.factory.createJsxAttribute(
          ts.factory.createIdentifier(METADATA_KEY),
          ts.factory.createJsxExpression(
            undefined,
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("fileName"),
                ts.factory.createStringLiteral(fileName)
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("lineNumber"),
                ts.factory.createNumericLiteral((line + 1).toString())
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("columnNumber"),
                ts.factory.createNumericLiteral((character + 1).toString())
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("componentName"),
                ts.factory.createStringLiteral(tagName)
              ),
            ])
          )
        );

        const newAttributes = ts.factory.createJsxAttributes([
          ...attributes,
          sourceProp,
        ]);

        if (ts.isJsxSelfClosingElement(node)) {
          return ts.factory.updateJsxSelfClosingElement(
            node,
            node.tagName,
            node.typeArguments,
            newAttributes
          );
        }

        return ts.factory.updateJsxOpeningElement(
          node,
          node.tagName,
          node.typeArguments,
          newAttributes
        );
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
    };
  };
}

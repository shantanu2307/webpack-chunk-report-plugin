const pathUtil = require('path');

const METADATA_KEY = "__REACT_COMPONENT_SOURCE__";

module.exports = function transformReactComponentSource() {
  return {
    visitor: {
      JSXOpeningElement(path) {
        const node = path.node;
        const tagName = node.name.name;

        // Only apply to PascalCase components
        if (!tagName || /^[a-z]/.test(tagName)) return;

        const alreadyHasSource = node.attributes.some(
          attr => attr.name && attr.name.name === METADATA_KEY
        );
        if (alreadyHasSource) return;

        const { line, column } = node.loc.start;
        const fileName = pathUtil.relative(process.cwd(), this.file.opts.filename);

        const sourceProp = {
          type: 'JSXAttribute',
          name: {
            type: 'JSXIdentifier',
            name: METADATA_KEY,
          },
          value: {
            type: 'JSXExpressionContainer',
            expression: {
              type: 'ObjectExpression',
              properties: [
                {
                  type: 'ObjectProperty',
                  key: {
                    type: 'Identifier',
                    name: 'fileName',
                  },
                  value: {
                    type: 'StringLiteral',
                    value: fileName,
                  },
                },
                {
                  type: 'ObjectProperty',
                  key: {
                    type: 'Identifier',
                    name: 'lineNumber',
                  },
                  value: {
                    type: 'NumericLiteral',
                    value: line,
                  },
                },
                {
                  type: 'ObjectProperty',
                  key: {
                    type: 'Identifier',
                    name: 'columnNumber',
                  },
                  value: {
                    type: 'NumericLiteral',
                    value: column + 1,
                  },
                },
                {
                  type: 'ObjectProperty',
                  key: {
                    type: 'Identifier',
                    name: 'componentName',
                  },
                  value: {
                    type: 'StringLiteral',
                    value: tagName,
                  },
                },
              ],
            },
          },
        };
        node.attributes.push(sourceProp);
      },
    },
  };
};
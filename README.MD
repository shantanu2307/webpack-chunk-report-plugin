# webpack-chunk-report-plugin

> A Webpack plugin to generate and embed chunk-level report for advanced bundle analysis, runtime inspection, and custom tooling.

## Features

- Infers the type of chunk
- Supports treeshaken exports
- Supports gzip size calculation for each module
- Helps in bundle visualization and performance optimization

## Installation

`npm install --save-dev webpack-chunk-report-plugin`
OR
`yarn add --dev webpack-chunk-report-plugin`

## Usage

In your Webpack configuration:

```ts
// webpack.config.js or webpack.config.ts
const { withChunkReportPlugin } = require("webpack-chunk-report-plugin");

// Assuming config is earlier webpack config.
const webpackConfig = withChunkreportPlugin({ enabled: true })(config);
```

### Example Output

The plugin will generate a file like `client.json` in your Webpack output directory:

```json
{
  "main": {
    "id": "main",
    "parsedSize": 1300,
    "gzipSize": 643,
    "statSize": 1549,
    "type": "sync",
    "modules": [
      {
        "label": "./src/index.js",
        "path": "./src/index.js",
        "exports": ["default", "foo"],
        "treeshakenExports": ["foo"],
        "parsedSize": 1200,
        "gzipSize": 456,
        "statSize": 1249
      }
    ]
  }
}
```

## Development

```bash
git clone https://github.com/shantanu2307/webpack-chunk-report-plugin.git
cd webpack-chunk-report-plugin
npm install
npm run build
```

To test locally in a Webpack project, use `npm link`:

```bash
cd webpack-chunk-report-plugin
npm link

cd ../your-webpack-project
npm link webpack-chunk-report-plugin
```

## License

MIT © [Shantanu Goyal](https://github.com/shantanu2307)

#!/usr/bin/env bash

set -e  # Exit immediately on error

echo "🔁 Starting postbuild packaging..."

# Clean old root dist if exists
echo "🧹 Cleaning up old root dist/..."
rm -rf dist

# Build new root dist
echo "📦 Assembling plugin output into root dist/..."
cp -r packages/plugin/dist dist

# Add app dist to dist/public
echo "📁 Creating dist/public and copying app output..."
mkdir -p dist/public
cp -r packages/app/dist/* dist/public/

# Clean original package build artifacts
echo "🧽 Cleaning up original package dist folders..."
rm -rf packages/plugin/dist
rm -rf packages/app/dist

# Move final dist back into plugin
echo "📦 Copying final dist into plugin package..."
cp -r dist packages/plugin/dist

# Clean root dist again
rm -rf dist

echo "✅ Postbuild complete!"

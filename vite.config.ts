import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rolldownOptions: {
      output: {
        // bibliotecas pesadas em pacotes próprios: só são baixadas pelas telas que as usam
        advancedChunks: {
          groups: [
            { name: 'graficos', test: /node_modules[\\/](recharts|victory-vendor|d3-(shape|scale|path|array|interpolate|color|format|time|time-format))[\\/]/ },
            { name: 'editor', test: /node_modules[\\/](@codemirror|@lezer|@uiw|codemirror|style-mod|w3c-keyname|crelt)[\\/]/ },
            { name: 'grafo', test: /node_modules[\\/](react-force-graph-2d|force-graph|d3-force-3d|d3-(zoom|drag|selection|transition|quadtree|octree|binarytree|timer|dispatch|ease)|kapsule|canvas-color-tracker|float-tooltip|react-kapsule|tinycolor2|accessor-fn|index-array-by|lodash-es|bezier-js|@tweenjs)[\\/]/ },
            { name: 'markdown', test: /node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|hast-|unified|unist-|vfile|property-information|html-url-attributes|decode-named|character-entities|zwitch|bail|trough|devlop|ccount|markdown-table|escape-string|longest-streak|space-separated|comma-separated|estree-|style-to-|inline-style)/ },
          ],
        },
      },
    },
  },
})

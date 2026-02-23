# Figma API scripts

Scripts that use the [Figma REST API](https://www.figma.com/developers/api) to pull file structure and support asset traceability. No npm install: run with Node 18+ (native `fetch`).

## Token

1. In Figma: **Settings → Account → Personal access tokens** (or [Figma → Personal access tokens](https://www.figma.com/settings)).
2. Create a token with at least **File content** read access for the file you use.
3. Set it when running scripts (do not commit it):

   ```bash
   export FIGMA_TOKEN=your-token-here
   ```

   Or create `design/figma/.env` with `FIGMA_TOKEN=...` and load it (e.g. `dotenv` or `source`) before running; `.env` is gitignored.

## list-frames.mjs

Prints an inventoried list of **frame name** and **node id** for the Compass KPI (Copy) file.

```bash
FIGMA_TOKEN=xxx node design/figma/scripts/list-frames.mjs
```

Optional: include component nodes (for component sheets):

```bash
FIGMA_TOKEN=xxx node design/figma/scripts/list-frames.mjs --components
```

Output is markdown table format. Use the node ids in `design/figma/FIGMA_INDEX.md` and `docs/spec/appendix/FIGMA_BUILD_MAPPING.md` (URL form: `node-id=XXX-YYY`).

## File key

The default file is **Compass KPI (Copy)** — key `ebEWgwdjIZywvK2b4zf0ek`. To change it, edit `FIGMA_FILE_KEY` (or the constant) in the script.

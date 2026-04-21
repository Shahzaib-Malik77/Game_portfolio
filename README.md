# M.Shahzaib Wajid - 3D Cloth Portfolio

A personal WebGL portfolio experiment inspired by an Arrival Space cloth demo.
This version is built as a standalone Three.js/Vite project so it can run
locally and deploy to Vercel.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL shown by Vite, usually `http://127.0.0.1:5173`.

## Build

```powershell
npm run build
```

## Deploy on Vercel

Import this GitHub repository into Vercel. Vercel will use:

- Build command: `npm run build`
- Output directory: `dist`

## Original export

The `plugins/`, `entities/`, and `manifest.json` files are kept as reference
from the original Arrival Space export. The deployable portfolio app lives in
`src/` and uses Three.js.

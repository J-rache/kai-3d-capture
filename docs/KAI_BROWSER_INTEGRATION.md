# Kai Browser Integration

Kai Browser should treat Kai 3D Capture as a local capture worker.

## Runtime Contract

Start the local worker:

```powershell
node C:\Users\Jae\Desktop\kai-3d-capture\src\server\kai-capture-server.mjs --port 3947 --workspace C:\Users\Jae\Desktop\Kai3DCaptureJobs
```

Health:

```http
GET http://127.0.0.1:3947/health
```

Reconstruct:

```http
POST http://127.0.0.1:3947/api/reconstruct
Content-Type: application/json
```

Body:

```json
{
  "name": "bracket-prototype",
  "mode": "turntable",
  "measurement": {
    "axis": "height",
    "millimeters": 120
  },
  "quality": {
    "widthSegments": 56,
    "heightSegments": 56,
    "depthMillimeters": 28
  },
  "frames": [
    {
      "name": "frame-000",
      "width": 56,
      "height": 56,
      "heights": [0.0, 0.2],
      "colors": [180, 170, 160]
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "jobId": "2026-05-21T08-00-00-bracket-prototype",
  "manifestPath": "C:\\...\\manifest.json",
  "exports": {
    "ply": "C:\\...\\model.ply",
    "obj": "C:\\...\\model.obj",
    "stl": "C:\\...\\model.stl"
  }
}
```

## Browser-Side Client

Kai Browser can import:

```js
import {
  createKaiCaptureClient,
  sampleImageElement,
  sampleVideoElement
} from "./integration/kai-browser/kai-capture-client.mjs";
```

The integration intentionally samples media inside Kai Browser and sends compact frame grids to localhost. That avoids pushing raw private video anywhere.

## Kai CAD Handoff

The manifest includes:

- `schema: "kai-capture-manifest.v1"`
- source frame count
- known measurement
- model extents in millimeters
- PLY/OBJ/STL paths
- confidence and truth limits

Kai CAD should use the mesh as a reference layer, then reconstruct clean CAD primitives from it.


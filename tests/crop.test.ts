import { test } from "node:test";
import assert from "node:assert/strict";
import { cropGeometry } from "../src/domain/crop";
for (const image of [
  { width: 4000, height: 3000 },
  { width: 800, height: 6000 },
  { width: 64, height: 32 },
  { width: 10000, height: 500 },
])
  test(`background accepts aspect ${image.width}x${image.height} and clamps drags inside image`, () => {
    for (const zoom of [1, 2, 6]) {
      const g = cropGeometry(
        image,
        { width: 180, height: 300 },
        { zoom, x: 99999, y: -99999 },
      );
      assert.ok(g.crop.originX >= 0 && g.crop.originY >= 0);
      assert.ok(g.crop.width > 0 && g.crop.height > 0);
      assert.ok(g.crop.originX + g.crop.width <= image.width);
      assert.ok(g.crop.originY + g.crop.height <= image.height);
      assert.ok(g.width >= 180 && g.height >= 300);
    }
  });

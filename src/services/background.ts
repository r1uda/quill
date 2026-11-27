import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
export async function cropBackground(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context
    .crop(crop)
    .resize({ width: Math.min(1080, crop.width) });
  const image = await context.renderAsync();
  try {
    for (const quality of [0.85, 0.65, 0.45]) {
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: quality,
        base64: true,
      });
      if (saved.base64 && saved.base64.length < 3000000)
        return `data:image/jpeg;base64,${saved.base64}`;
    }
    // Keep the chosen framing and reduce storage size automatically.
    const smaller = ImageManipulator.manipulate(uri);
    smaller
      .crop(crop)
      .resize({ width: Math.min(720, crop.width) });
    const rendered = await smaller.renderAsync();
    try {
      const saved = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.6,
        base64: true,
      });
      if (!saved.base64) throw new Error("未能处理这张图片，请重新选择");
      return `data:image/jpeg;base64,${saved.base64}`;
    } finally {
      rendered.release();
      smaller.release();
    }
  } finally {
    image.release();
    context.release();
  }
}

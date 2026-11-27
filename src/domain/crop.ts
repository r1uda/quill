export interface ImageSize {
  width: number;
  height: number;
}
export interface CropTransform {
  zoom: number;
  x: number;
  y: number;
}
export function cropGeometry(
  image: ImageSize,
  frame: ImageSize,
  transform: CropTransform,
) {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    frame.width <= 0 ||
    frame.height <= 0
  )
    throw new Error("无法读取图片尺寸");
  const scale =
    Math.max(frame.width / image.width, frame.height / image.height) *
    Math.max(1, transform.zoom);
  const width = image.width * scale,
    height = image.height * scale;
  const x = Math.max(
    -(width - frame.width) / 2,
    Math.min((width - frame.width) / 2, transform.x),
  );
  const y = Math.max(
    -(height - frame.height) / 2,
    Math.min((height - frame.height) / 2, transform.y),
  );
  const originX = Math.max(
    0,
    Math.round(((width - frame.width) / 2 - x) / scale),
  );
  const originY = Math.max(
    0,
    Math.round(((height - frame.height) / 2 - y) / scale),
  );
  return {
    scale,
    width,
    height,
    x,
    y,
    crop: {
      originX,
      originY,
      width: Math.max(
        1,
        Math.min(image.width - originX, Math.round(frame.width / scale)),
      ),
      height: Math.max(
        1,
        Math.min(image.height - originY, Math.round(frame.height / scale)),
      ),
    },
  };
}

import sharp from "sharp";

export const MAX_ARTWORK_UPLOAD_BYTES = 5 * 1024 * 1024;

const FORMAT_BY_MIME = {
  "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp",
};

// Base64 adds about one third to the payload. Leave room for document metadata.
const MAX_STORED_BYTES = 1_250_000;

export async function prepareArtwork(bytes, mime) {
  const format = FORMAT_BY_MIME[mime];
  if (!Object.hasOwn(FORMAT_BY_MIME, mime) || !bytes.length || bytes.length > MAX_ARTWORK_UPLOAD_BYTES) {
    throw new Error("Select a PNG, JPG or WebP image up to 5 MB.");
  }
  const image = sharp(bytes, { limitInputPixels: 32_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (metadata.format !== format || (metadata.pages ?? 1) > 1) {
    throw new Error("Select a still image matching its declared format.");
  }

  const render = (maxSize, quality) => image.clone()
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  let optimized = await render(1920, 84);
  if (optimized.length > MAX_STORED_BYTES) optimized = await render(1440, 72);
  if (optimized.length > MAX_STORED_BYTES) throw new Error("Image is too detailed. Try a smaller image.");
  return optimized;
}

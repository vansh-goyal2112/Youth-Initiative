import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareArtwork } from "../src/services/prepareArtwork.mjs";
import { validateBadgeDefinition } from "../src/services/customBadges.mjs";
import { artworkIdFromPath } from "../src/utils/mediaArtwork.mjs";

test("PNG, JPEG and WebP uploads are converted to bounded WebP artwork", async () => {
  for (const format of ["png", "jpeg", "webp"]) {
    const original = await sharp({
      create: { width: 2100, height: 900, channels: 3, background: "#981e32" },
    }).toFormat(format).toBuffer();
    const stored = await prepareArtwork(original, "image/" + format);
    const metadata = await sharp(stored).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1920);
    assert.ok(stored.length < 1_250_000);
    await assert.rejects(() => prepareArtwork(original, "image/gif"));
  }
});

test("artwork must decode as the advertised image type", async () => {
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#981e32" },
  }).png().toBuffer();
  await assert.rejects(() => prepareArtwork(png, "image/jpeg"), /declared format/);
  await assert.rejects(() => prepareArtwork(png.subarray(0, 9), "image/png"));
});

test("badge edits accept uploaded artwork and keep rejecting arbitrary relative URLs", () => {
  const id = "a3031224-2551-4055-ae03-49da110c99e2";
  const path = "/api/media/artwork/" + id;
  const badge = { name: "Test badge", rule: { type: "sessions_any", minCount: 1 } };
  assert.equal(artworkIdFromPath(path), id);
  assert.equal(validateBadgeDefinition({ ...badge, artworkUrl: path }).artworkUrl, path);
  assert.equal(artworkIdFromPath(path + "/extra"), null);
  assert.throws(() => validateBadgeDefinition({ ...badge, artworkUrl: "/api/admin/media/upload" }));
});

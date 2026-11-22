/* Getting an uploaded image ready for the site, in the browser before upload:
   - shrink it to at most MAX_SIDE pixels on its long side and re-encode it (WebP, or PNG/JPEG
     where the browser can't write WebP) so a 3MB photo becomes a light file
   - measure it, so the site can reserve its exact frame before it loads
   - make a tiny version (a few hundred bytes) to show blurred while the real one loads */
const MAX_SIDE = 1400;

const toBlob = (canvas, type, quality) => new Promise(r => canvas.toBlob(r, type, quality));

export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const W = bitmap.width, H = bitmap.height;

  // the blurred stand-in: 24px wide is plenty, since it is shown blurred
  const tiny = document.createElement('canvas');
  tiny.width = 24; tiny.height = Math.max(1, Math.round(24 * H / W));
  tiny.getContext('2d').drawImage(bitmap, 0, 0, tiny.width, tiny.height);
  const blur = tiny.toDataURL('image/jpeg', .6);

  // an animated GIF would lose its animation on a canvas: keep it as it is
  if (file.type === 'image/gif') { bitmap.close && bitmap.close(); return { blob: file, width: W, height: H, blur }; }

  const scale = Math.min(1, MAX_SIDE / Math.max(W, H));
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close && bitmap.close();

  let blob = await toBlob(canvas, 'image/webp', .85);
  // browsers that can't write WebP hand back a PNG; then keep transparency for PNGs, JPEG for the rest
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, file.type === 'image/png' ? 'image/png' : 'image/jpeg', .86);

  // if the "lighter" file came out heavier (an already small image), upload the original
  if (!blob || blob.size >= file.size) return { blob: file, width: W, height: H, blur };
  return { blob, width: w, height: h, blur };
}

export const extOf = type => ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[type] || 'jpg');

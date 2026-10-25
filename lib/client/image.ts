// Shrink a photo in the browser before sending it, so requests stay small
// (Vercel rejects request bodies over about 4.5 MB).
export async function compressImage(file: File, maxEdge = 1280, quality = 0.85): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error(`Could not read ${file.name}. Use a JPG, PNG or WebP image.`);
  });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", quality);
}

// Re-encode an image that is already a data URL at a smaller size (used to keep saved headshots light).
export async function shrinkDataUrl(dataUrl: string, maxEdge = 1024, quality = 0.82): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

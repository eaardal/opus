/**
 * Resize a data-URL image so its longest edge is at most `maxPx`, returning a
 * new JPEG data URL at quality 0.85. Uses a 2D canvas — requires a real
 * browser-style DOM (jsdom does not implement canvas drawing fully, so the
 * function is not directly unit-tested).
 */
export async function resizeDataUrlImage(dataUrl: string, maxPx = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

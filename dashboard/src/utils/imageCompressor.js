/**
 * Client-side high-efficiency image compressor for MCQ diagrams & options.
 * Converts images into compact Base64 JPEG data URLs (< 30 KB) using HTML5 Canvas.
 * Directly compatible with Firestore storage and Android Base64 bitmap decoders.
 */

/**
 * Compresses an image file and returns a Base64 data URL.
 * 
 * @param {File|Blob} file The original image file from input picker
 * @param {number} maxWidth The maximum allowed width (keeps aspect ratio, default 800px)
 * @param {number} quality The JPEG compression quality (0.0 to 1.0, default 0.65)
 * @returns {Promise<{ base64Url: string, sizeKb: number, originalSizeKb: number, savedPercent: number }>}
 */
export function compressImageToBase64(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    if (!file || (!file.type?.startsWith('image/') && !file.name?.match(/\.(jpe?g|png|webp|bmp|gif)$/i))) {
      reject(new Error('Selected file is not a supported image.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Resize if width exceeds max
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to create canvas context.'));
            return;
          }

          // Draw image with smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Export directly to JPEG Data URL
          const base64Url = canvas.toDataURL('image/jpeg', quality);
          const sizeInBytes = Math.round((base64Url.length * 3) / 4);
          const sizeKb = (sizeInBytes / 1024).toFixed(1);
          const originalSizeKb = (file.size / 1024).toFixed(1);
          const savedPercent = Math.max(0, Math.round(((file.size - sizeInBytes) / file.size) * 100));

          resolve({
            base64Url,
            sizeKb: parseFloat(sizeKb),
            originalSizeKb: parseFloat(originalSizeKb),
            savedPercent
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Could not parse image data.'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };
  });
}

// Backward-compatible export
export async function compressImage(file, maxWidth = 800, quality = 0.65) {
  const res = await compressImageToBase64(file, maxWidth, quality);
  // Convert data URL back to Blob for callers expecting Blob
  const byteString = atob(res.base64Url.split(',')[1]);
  const mimeString = res.base64Url.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

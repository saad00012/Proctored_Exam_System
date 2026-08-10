/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * Resizes the image to fit within maxWidth and exports as JPEG with specified quality.
 * 
 * @param {File} file The original image file from input picker
 * @param {number} maxWidth The maximum allowed width (keeps aspect ratio)
 * @param {number} quality The JPEG compression quality (0.0 to 1.0)
 * @returns {Promise<Blob>} A promise that resolves to the compressed image Blob
 */
export function compressImage(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // If the file is not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // Create canvas and context
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas.'));
          return;
        }
        
        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Original size: ${(file.size / 1024).toFixed(2)} KB, Compressed size: ${(blob.size / 1024).toFixed(2)} KB`);
              resolve(blob);
            } else {
              reject(new Error('Canvas export to blob failed.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = (err) => {
        reject(new Error('Failed to load image resource: ' + err.message));
      };
    };
    
    reader.onerror = (err) => {
      reject(new Error('Failed to read image file: ' + err.message));
    };
  });
}

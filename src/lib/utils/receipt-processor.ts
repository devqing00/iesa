/**
 * Receipt File Processor
 * Handles client-side compression, format normalization, and PDF support
 * for bank transfer receipt uploads across mobile and desktop browsers.
 */

export interface ProcessedReceipt {
  file: File;
  previewUrl: string | null;
  isPdf: boolean;
  name: string;
  sizeFormatted: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Downscales images larger than maxWidth/maxHeight to save bandwidth
 * and avoid mobile payload/timeout issues.
 */
async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<{ file: File; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    // If not running in browser, return original
    if (typeof window === "undefined") {
      const url = URL.createObjectURL(file);
      return resolve({ file, previewUrl: url });
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback to original file
        const fallbackUrl = URL.createObjectURL(file);
        return resolve({ file, previewUrl: fallbackUrl });
      }

      // Draw with white background to avoid transparent PNG issues when converting to JPEG
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            const fallbackUrl = URL.createObjectURL(file);
            return resolve({ file, previewUrl: fallbackUrl });
          }

          // Create clean JPEG filename
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const compressedFile = new File([blob], cleanName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          const previewUrl = URL.createObjectURL(compressedFile);
          resolve({ file: compressedFile, previewUrl });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If canvas loading fails (e.g. raw HEIC on unsupported browser), pass original file
      const fallbackUrl = URL.createObjectURL(file);
      resolve({ file, previewUrl: fallbackUrl });
    };

    img.src = objectUrl;
  });
}

/**
 * Main processor entrypoint for selected receipt files.
 */
export async function processReceiptFile(file: File): Promise<ProcessedReceipt> {
  if (isPdfFile(file)) {
    // PDFs don't use canvas compression or blob preview
    return {
      file,
      previewUrl: null,
      isPdf: true,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
    };
  }

  // Process and compress image
  try {
    const { file: processedFile, previewUrl } = await compressImage(file);
    return {
      file: processedFile,
      previewUrl,
      isPdf: false,
      name: processedFile.name,
      sizeFormatted: formatFileSize(processedFile.size),
    };
  } catch {
    // Safe fallback
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      isPdf: false,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
    };
  }
}

/**
 * Utilities for Authorized Signature & Official Company Seal:
 * - Automatic Background Removal (converts white/paper backgrounds to transparent PNG)
 * - Auto-Cropping of transparent bounds
 * - Transparent SVG Generators for Digital Signature & Official Circular Company Seal
 */

export const removeImageBackground = (
  source: File | string,
  threshold: number = 225
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      if (dataUrl.startsWith('data:image/svg+xml')) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const MAX_DIM = 700;
        let width = img.width || 400;
        let height = img.height || 200;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Sample corner pixels to estimate paper background brightness
        const sampleCorner = (x: number, y: number) => {
          const idx = (y * width + x) * 4;
          return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
        };
        const corners = [
          sampleCorner(0, 0),
          sampleCorner(width - 1, 0),
          sampleCorner(0, height - 1),
          sampleCorner(width - 1, height - 1)
        ].filter(c => c.a > 128);

        let bgR = 255;
        let bgG = 255;
        let bgB = 255;
        if (corners.length > 0) {
          bgR = Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length);
          bgG = Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length);
          bgB = Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length);
        }

        const softRange = 35;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          // Perceived luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Distance from corner paper color
          const distFromBg = Math.sqrt(
            Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
          );

          // If pixel is bright white/light paper OR very close to sampled light corner background
          if (lum >= threshold || (bgR > 190 && bgG > 190 && bgB > 190 && distFromBg < 32)) {
            data[i + 3] = 0;
          } else if (lum >= threshold - softRange) {
            // Smooth anti-aliased edge transition
            const factor = (threshold - lum) / softRange;
            data[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
          } else {
            // Slightly deepen ink contrast for crisp printing on white paper
            data[i] = Math.max(0, Math.round(r * 0.9));
            data[i + 1] = Math.max(0, Math.round(g * 0.9));
            data[i + 2] = Math.max(0, Math.round(b * 0.9));
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Auto-crop transparent padding (leaving a clean 8px margin)
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let hasInk = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 15) {
              hasInk = true;
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (hasInk && maxX > minX && maxY > minY) {
          const pad = 10;
          const cropX = Math.max(0, minX - pad);
          const cropY = Math.max(0, minY - pad);
          const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
          const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropW;
          croppedCanvas.height = cropH;
          const croppedCtx = croppedCanvas.getContext('2d');
          if (croppedCtx) {
            croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            resolve(croppedCanvas.toDataURL('image/png'));
            return;
          }
        }

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Failed to load image for background removal.'));
      img.src = dataUrl;
    };

    if (typeof source === 'string') {
      processDataUrl(source);
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        if (e.target?.result) {
          processDataUrl(e.target.result as string);
        } else {
          reject(new Error('Failed to read file.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(source);
    }
  });
};

/**
 * Generate a clean transparent-background SVG digital signature
 */
export const generateDigitalSignatureSvg = (
  signatoryName: string,
  inkColor: string = '#1e3a8a'
): string => {
  const cleanText = (signatoryName || 'Authorized Signatory').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110" fill="none">
    <path d="M22 76 C55 28, 72 88, 108 52 C132 28, 142 78, 178 48 C206 25, 224 68, 286 42" stroke="${inkColor}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <path d="M40 88 Q155 68 295 79" stroke="${inkColor}" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>
    <text x="155" y="64" text-anchor="middle" fill="${inkColor}" font-family="Georgia, 'Times New Roman', cursive, serif" font-style="italic" font-weight="bold" font-size="26" letter-spacing="1">${cleanText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Generate an official transparent-background circular corporate seal / stamp SVG
 */
export const generateOfficialSealSvg = (
  companyName: string,
  trnNumber?: string,
  inkColor: string = '#1e40af'
): string => {
  const cleanCompany = (companyName || 'OFFICIAL COMPANY SEAL').toUpperCase().replace(/[<>&"']/g, '').slice(0, 34);
  const cleanTrn = trnNumber ? `TRN: ${trnNumber.replace(/[<>&"']/g, '')}` : 'AUTHORIZED COMMERCIAL SEAL';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220" fill="none">
    <defs>
      <path id="topArc" d="M 32,110 A 78,78 0 1,1 188,110" />
      <path id="bottomArc" d="M 188,110 A 78,78 0 1,1 32,110" />
    </defs>
    <circle cx="110" cy="110" r="98" stroke="${inkColor}" stroke-width="4" opacity="0.88"/>
    <circle cx="110" cy="110" r="91" stroke="${inkColor}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/>
    <circle cx="110" cy="110" r="62" stroke="${inkColor}" stroke-width="2" opacity="0.85"/>
    <text fill="${inkColor}" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" letter-spacing="1.8" opacity="0.92">
      <textPath href="#topArc" startOffset="50%" text-anchor="middle">${cleanCompany}</textPath>
    </text>
    <text fill="${inkColor}" font-family="Arial, sans-serif" font-size="9.5" font-weight="bold" letter-spacing="1.4" opacity="0.88">
      <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">★ ${cleanTrn} ★</textPath>
    </text>
    <line x1="52" y1="98" x2="168" y2="98" stroke="${inkColor}" stroke-width="1.5" opacity="0.8"/>
    <text x="110" y="114" text-anchor="middle" fill="${inkColor}" font-family="Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.5" opacity="0.92">APPROVED &amp; SEALED</text>
    <line x1="52" y1="122" x2="168" y2="122" stroke="${inkColor}" stroke-width="1.5" opacity="0.8"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

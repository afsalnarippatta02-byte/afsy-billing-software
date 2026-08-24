import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice, Client, CompanySettings, InvoiceStatus } from '../types';

export interface ExportProgressCallback {
  (status: 'preparing' | 'rendering' | 'saving' | 'done' | 'error', message?: string): void;
}

/**
 * Cleanly print an element by isolating its HTML into a hidden iframe
 * and triggering print on that iframe. This completely avoids iframe / sidebar
 * layout issues, scroll clipping, or unstyled outputs.
 */
export const printElementDirectly = (elementId: string, title?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        window.print();
        resolve(true);
        return;
      }

      // Collect all stylesheets and style tags from current document
      let stylesHtml = '';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        stylesHtml += node.outerHTML;
      });

      // Create a hidden print iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('title', title || 'Print Document');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        resolve(true);
        return;
      }

      // Clone content and remove any elements marked with .no-print
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.no-print').forEach((el) => el.remove());
      clone.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach((el) => {
        (el as HTMLElement).style.display = 'block';
      });

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${title || 'Document'}</title>
            ${stylesHtml}
            <style>
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                margin: 0;
                padding: 12px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 6px 8px; }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.error('Iframe print error, falling back to window.print', err);
          window.print();
          resolve(true);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 350);
    } catch (e) {
      console.error('Print failed:', e);
      window.print();
      resolve(false);
    }
  });
};

/**
 * Exports any DOM element to a clean, crisp A4 PDF file and triggers instant browser download.
 */
export const downloadElementAsPdf = async (
  elementId: string,
  filename: string,
  onProgress?: ExportProgressCallback
): Promise<boolean> => {
  try {
    if (onProgress) onProgress('preparing', 'Preparing document for PDF export...');
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found.`);
    }

    // Scroll to top of element to ensure full capture
    element.scrollIntoView();

    if (onProgress) onProgress('rendering', 'Rendering high-resolution canvas...');

    // High quality canvas capture with onclone transforming inputs/textareas/selects into clean visible text
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution (2x retina)
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      onclone: (clonedDoc, clonedElement) => {
        // 1. Hide interactive non-printable elements
        clonedElement.querySelectorAll('.no-print').forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        // 2. Make all print fallback elements visible
        clonedElement.querySelectorAll('.hidden.print\\:block, [class*="print:block"], .print-visible, .item-description-print, .item-qty-print, .item-rate-print, .notes-print').forEach((el) => {
          (el as HTMLElement).style.display = 'block';
          (el as HTMLElement).classList.remove('hidden');
        });

        // 3. Convert any inputs to visible rendered text
        clonedElement.querySelectorAll('input').forEach((input) => {
          if (input.type === 'button' || input.type === 'submit') return;
          if (input.parentElement?.querySelector('.print\\:block, .item-description-print, .item-qty-print, .item-rate-print')) {
            // Already handled by print sibling
            return;
          }
          const span = clonedDoc.createElement('span');
          span.textContent = input.value || '';
          span.className = input.className.replace('no-print', '').replace('bg-slate-100', 'bg-transparent');
          input.parentNode?.replaceChild(span, input);
        });

        // 4. Convert textareas to pre-lined text blocks
        clonedElement.querySelectorAll('textarea').forEach((ta) => {
          if (ta.parentElement?.querySelector('.print\\:block, .notes-print')) {
            return;
          }
          const div = clonedDoc.createElement('div');
          div.textContent = ta.value || '';
          div.style.whiteSpace = 'pre-line';
          div.className = 'text-sm text-slate-700 leading-relaxed';
          ta.parentNode?.replaceChild(div, ta);
        });

        // 5. Convert select dropdowns to selected text
        clonedElement.querySelectorAll('select').forEach((sel) => {
          if (sel.parentElement?.querySelector('.print\\:block')) {
            return;
          }
          const selectedText = sel.options[sel.selectedIndex]?.text || '';
          const div = clonedDoc.createElement('div');
          div.textContent = selectedText;
          div.className = 'font-bold text-slate-900 text-base';
          sel.parentNode?.replaceChild(div, sel);
        });
      }
    });

    if (onProgress) onProgress('saving', 'Generating PDF file...');

    const imgData = canvas.toDataURL('image/png');
    
    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = 210; // A4 width
    const pdfHeight = 297; // A4 height
    
    // Calculate aspect ratio
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    // Handle multi-page if content exceeds 1 page
    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    if (onProgress) onProgress('done', 'PDF downloaded successfully!');
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    if (onProgress) onProgress('error', 'Could not generate PDF. Opening print dialog instead.');
    
    // Fallback: Direct print to PDF
    printElementDirectly(elementId, filename);
    return false;
  }
};

/**
 * Programmatically generates a standalone, styled HTML file download as an ultra-reliable
 * offline backup if browser blocking prevents canvas capture.
 */
export const downloadDocumentAsHtml = (
  elementId: string, 
  filename: string, 
  title: string
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());
  clone.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach((el) => {
    (el as HTMLElement).style.display = 'block';
  });

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f8fafc; padding: 40px 20px; }
    .date-badge-black { background: #000; color: #fff; padding: 6px 14px; border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
    ${clone.outerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.html') ? filename : `${filename}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

import api from '../api';

/**
 * Generates a multi-page PDF by rendering HTML content on top of a template background.
 * Uses html2canvas directly (NOT jsPDF) to avoid cross-library compatibility issues.
 * 
 * How it works:
 * 1. Renders the full HTML into a single large canvas via html2canvas
 * 2. Calculates how many A4 pages are needed based on content height
 * 3. Crops the canvas into page-sized chunks
 * 4. Creates a PDF with pdf-lib: draws template background + content chunk on each page
 * 
 * @param {string} htmlContent - The letter HTML content.
 * @param {string} templateUrl - URL to the template image (JPG/PNG) or PDF.
 * @returns {Promise<string>} - Base64 Data URI of the final PDF.
 */
export const generateOfferLetterPdf = async (htmlContent, templateUrl = '/Arah_Template.jpg') => {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const html2canvas = (await import('html2canvas')).default;

        // ── A4 dimensions in points ─────────────────────────────
        const A4_W = 595.28;
        const A4_H = 841.89;

        // ── Layout config ───────────────────────────────────────
        const isDense = htmlContent.length > 2500 ||
            htmlContent.includes("Annexure") ||
            htmlContent.includes("Salary Structure") ||
            htmlContent.includes("REMUNERATION");

        const CONTAINER_W = 790;  // px — the rendering width
        const CANVAS_SCALE = 1.5;   // 1.5x for crisp text and smaller file size

        const yStart = isDense ? 110 : 140;   // pt — space for template header
        const bottomMargin = 65;               // pt — space for template footer
        const padding = isDense ? '35px 50px' : '50px 60px';
        const fontSize = isDense ? '12px' : '16px';
        const lineHeight = isDense ? '1.45' : '1.8';
        const pMargin = isDense ? '8px' : '15px';
        const hMargin = isDense ? '12px' : '25px';
        const tableSize = isDense ? '11px' : '14px';

        // ── 1. Render HTML to one big canvas ────────────────────
        const container = document.createElement('div');

        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            * { 
                font-family: Helvetica, Arial, sans-serif !important;
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
            }
            p { margin-bottom: ${pMargin} !important; }
            h3, h4, strong, b {
                margin-top: ${hMargin} !important;
                margin-bottom: 5px !important;
                color: #000000 !important;
            }
            h3 { font-size: ${parseInt(fontSize) + 2}px !important; }
            .date-row {
                display: flex; justify-content: flex-end;
                align-items: center;
                margin-bottom: ${isDense ? '5px' : '20px'} !important;
            }
            table {
                margin-top: 5px !important; width: 100% !important;
                font-size: ${tableSize} !important;
                border-collapse: collapse !important;
            }
            td, th {
                padding: ${isDense ? '3px' : '8px'} !important;
                border: 1px solid #d1d5db !important;
                color: #000000 !important;
            }
            img { display: block !important; border: none !important; outline: none !important; box-shadow: none !important; }
        `;
        container.appendChild(styleEl);

        Object.assign(container.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            zIndex: '-9999',
            width: CONTAINER_W + 'px',
            background: 'transparent',
            fontSize,
            lineHeight,
            color: '#000000',
            webkitFontSmoothing: 'antialiased',
            padding,
        });
        container.innerHTML += htmlContent;   // appends after <style>
        document.body.appendChild(container);

        // Force black text on every element
        container.querySelectorAll('*').forEach(el => {
            el.style.color = '#000000';
            el.style.webkitTextFillColor = '#000000';
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'TD', 'TH'].includes(el.tagName)) {
                el.style.fontWeight = 'bold';
            }
        });

        // Capture full content as one tall canvas
        const fullCanvas = await html2canvas(container, {
            scale: CANVAS_SCALE,
            backgroundColor: null,   // transparent — template shows through
            logging: false,
            useCORS: true,
            allowTaint: true,
        });
        document.body.removeChild(container);

        console.log(`PDF: Canvas captured — ${fullCanvas.width}x${fullCanvas.height}px`);

        // ── 2. Calculate page slicing ───────────────────────────
        // How many container-pixels fit in one A4 page's content area?
        const scaleFactor = A4_W / CONTAINER_W;                   // ~0.7535
        const contentAreaPt = A4_H - yStart - bottomMargin;       // ~721.89 pt
        const containerPxPerPage = contentAreaPt / scaleFactor;    // ~958 px
        const canvasPxPerPage = containerPxPerPage * CANVAS_SCALE; // canvas pixels per page

        const totalPages = Math.ceil(fullCanvas.height / canvasPxPerPage);
        console.log(`PDF: Will produce ${totalPages} page(s)  (canvas height=${fullCanvas.height}, per-page=${Math.round(canvasPxPerPage)})`);

        let templateImage = null;
        let templatePdfDoc = null;

        // ── 3. Load Background Template ─────────────────────────
        console.log("📥 PDF Generator: Loading template from:", templateUrl);

        const isImage = /\.(jpg|jpeg|png)$/i.test(templateUrl);

        try {
            if (templateUrl.startsWith("/")) {
                 console.log("🔄 PDF Generator: Accessing local template directly:", templateUrl);
                 const res = await fetch(templateUrl);
                 if (!res.ok) throw new Error("Local template not found (HTTP " + res.status + ")");
                 const arrayBuf = await res.arrayBuffer();
                 // If the router matched the wildcard React route, it sends HTML. Detect that block.
                 const hdr = new Uint8Array(arrayBuf.slice(0, 4));
                 if (hdr[0] === 0x3C && hdr[1] === 0x21 && hdr[2] === 0x44) {
                     console.warn("⚠️ PDF Template appears to be a React HTML fallback. Template was likely deleted. Reverting to blank background.");
                     templateImage = null;
                 } else {
                     templateImage = arrayBuf;
                 }
             } else {
                 console.log("🔄 PDF Generator: Fetching template via backend proxy to bypass CORS...");
                 const proxyUrl = `/api/offer-letters/templates/fetch?url=${encodeURIComponent(templateUrl)}`;
                 const res = await api.get(proxyUrl, { responseType: 'arraybuffer' });
                 const buffer = res.data;

                 const hdr = new Uint8Array(buffer.slice(0, 4));
                 const isPdfMagic = (hdr[0] === 0x25 && hdr[1] === 0x50 && hdr[2] === 0x44 && hdr[3] === 0x46);

                 if (!isPdfMagic) {
                     templateImage = buffer;
                     console.log(`✅ PDF Generator: Template Image fetched via proxy (${buffer.byteLength} bytes)`);
                 } else {
                     templatePdfDoc = await PDFDocument.load(buffer);
                     console.log(`✅ PDF Generator: Template PDF fetched via proxy`);
                 }
            }
        } catch (err) {
            console.warn(`❌ PDF Generator: Fetch failed for ${templateUrl}`, err.message);
            console.warn("⚠️ Falling back to clean white background because the template image could not be loaded!");
            templateImage = null;
            templatePdfDoc = null;
        }

        // ── 4. Assemble final PDF ───────────────────────────────
        const finalDoc = await PDFDocument.create();

        // Embed template image once (reused on every page)
        let embeddedTemplateImg = null;
        if (templateImage) {
            const imgHex = new Uint8Array(templateImage.slice(0, 4)).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
            const isPng = imgHex.startsWith('89504e47');

            if (isPng) {
                embeddedTemplateImg = await finalDoc.embedPng(templateImage);
            } else {
                // Assume JPG fallback
                embeddedTemplateImg = await finalDoc.embedJpg(templateImage);
            }
        }

        for (let p = 0; p < totalPages; p++) {
            // ─ Crop the canvas for this page ─
            const srcY = p * canvasPxPerPage;
            const srcH = Math.min(canvasPxPerPage, fullCanvas.height - srcY);
            const srcW = fullCanvas.width;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = srcW;
            cropCanvas.height = Math.round(srcH);
            const ctx = cropCanvas.getContext('2d');
            ctx.drawImage(fullCanvas, 0, srcY, srcW, srcH, 0, 0, srcW, Math.round(srcH));

            // Convert crop to PNG bytes
            const pngDataUrl = cropCanvas.toDataURL('image/png');
            const pngBytes = await fetch(pngDataUrl).then(r => r.arrayBuffer());
            const pngImage = await finalDoc.embedPng(pngBytes);

            // ─ Create page ─
            const page = finalDoc.addPage([A4_W, A4_H]);

            // Draw template background
            if (embeddedTemplateImg) {
                page.drawImage(embeddedTemplateImg, { x: 0, y: 0, width: A4_W, height: A4_H });
            } else if (templatePdfDoc) {
                // For PDF templates: copy page 0 as background
                const [bgPage] = await finalDoc.embedPdf(templatePdfDoc, [0]);
                page.drawPage(bgPage, { x: 0, y: 0, width: A4_W, height: A4_H });
            }

            // Draw content on top — positioned below the template header
            const drawW = A4_W;
            const drawH = (srcH / srcW) * drawW;   // maintain aspect ratio
            page.drawImage(pngImage, {
                x: 0,
                y: A4_H - yStart - drawH,   // PDF y=0 is bottom
                width: drawW,
                height: drawH,
            });
        }

        // ── 5. Serialize to base64 data URI ─────────────────────
        const pdfBytes = await finalDoc.save();
        const bytes = new Uint8Array(pdfBytes);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        console.log(`PDF: Final document — ${totalPages} page(s), ${pdfBytes.byteLength} bytes`);
        return 'data:application/pdf;base64,' + window.btoa(binary);

    } catch (err) {
        console.error("PDF Template Error:", err);
        throw err;
    }
};

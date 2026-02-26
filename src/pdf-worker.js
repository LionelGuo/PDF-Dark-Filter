// src/pdf-worker.js
let pdfLibUrl = '';

self.onmessage = async function(e) {
  const { pdfData, bgColor, useColorFilter, libUrl } = e.data;
  
  try {
    if (!self.PDFLib && libUrl) {
      importScripts(libUrl);
    }

    const pdflib = self.PDFLib;
    if (!pdflib) throw new Error('PDFLib not found.');

    const { PDFDocument, rgb, BlendMode } = pdflib;
    const uint8 = new Uint8Array(pdfData);
    const pdfDoc = await PDFDocument.load(uint8);
    
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    };

    if (useColorFilter) {
      const fillColor = hexToRgb(bgColor);
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawRectangle({
          x: 0, y: 0, width: width, height: height,
          color: fillColor,
          blendMode: BlendMode.Multiply
        });
      });
    }

    const pdfBytes = await pdfDoc.save();
    self.postMessage({ success: true, pdfBytes: pdfBytes }, [pdfBytes.buffer]);
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};

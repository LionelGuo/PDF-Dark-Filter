(async function() {
  if (window.location.protocol === 'blob:') return;
  const isPdf = document.contentType === 'application/pdf' || window.location.pathname.toLowerCase().endsWith('.pdf');
  if (!isPdf) return;

  // 1. 立即注入遮罩样式，防止原生 PDF 浏览器闪烁
  const style = document.createElement('style');
  style.id = 'pdf-filter-initial-style';
  style.innerHTML = `
    html, body { background: #333 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
    #pdf-loading-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: #333; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.8s ease; /* 加长淡出时间 */
    }
    .loading-spinner {
      color: #aaa; font-family: sans-serif; font-size: 14px;
    }
  `;
  document.documentElement.appendChild(style);

  // 创建加载遮罩
  const overlay = document.createElement('div');
  overlay.id = 'pdf-loading-overlay';
  overlay.innerHTML = '<div class="loading-spinner">Applying Eye Protection...</div>';
  document.documentElement.appendChild(overlay);

  async function processPdf() {
    chrome.storage.sync.get(['pdfBgColor', 'pdfFilterEnabled'], async (result) => {
      const isEnabled = result.pdfFilterEnabled !== false;
      const bgColor = result.pdfBgColor || '#d3d3d3';

      if (!isEnabled) {
        overlay.remove();
        style.remove();
        return;
      }

      overlay.style.backgroundColor = bgColor;

      chrome.runtime.sendMessage({ type: 'FETCH_PDF', url: window.location.href }, async (response) => {
        if (!response || !response.success) {
          overlay.remove();
          return;
        }

        try {
          const binaryString = atob(response.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;

          const { PDFDocument, rgb, BlendMode } = PDFLib;
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          
          const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return rgb(r, g, b);
          };
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

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const newUrl = URL.createObjectURL(blob);
          
          const embed = document.createElement('embed');
          embed.src = newUrl;
          embed.type = 'application/pdf';
          embed.style.cssText = 'width:100vw; height:100vh; border:none; display:block;';
          
          document.body.innerHTML = '';
          document.body.appendChild(embed);

          // 关键修改：大幅增加等待时间
          // 800ms 的延迟足以覆盖大多数情况下 PDF 渲染器的启动白屏
          setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
              overlay.remove();
              style.innerHTML = `html, body { background: ${bgColor} !important; margin: 0; overflow: hidden; }`;
            }, 800); // 匹配 0.8s 的 transition 时间
          }, 800); 

        } catch (e) {
          console.error('[PDF-Filter] Error:', e);
          overlay.remove();
        }
      });
    });
  }

  // 等待 pdf-lib 加载完成
  const checkLib = setInterval(() => {
    if (typeof PDFLib !== 'undefined') {
      clearInterval(checkLib);
      processPdf();
    }
  }, 50);
})();

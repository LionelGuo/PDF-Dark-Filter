(async function() {
  // 忽略已处理的 blob 页面
  if (window.location.protocol === 'blob:') return;

  // --- 配置变量 ---
  const FADE_START_DELAY = 500; 
  const FADE_DURATION = 1500;    
  const OVERLAY_ALPHA = 1.0;      
  const SHOW_LOADING_TEXT = false; 
  // --------------

  let vantaEffect = null;
  let processingStarted = false;

  // 判定是否为 PDF 的工具函数 (处理 URL 参数和哈希)
  const isLikelyPdf = () => {
    const url = window.location.href.split(/[?#]/)[0].toLowerCase();
    const hasPdfExtension = url.endsWith('.pdf');
    const hasPdfType = document.contentType === 'application/pdf';
    // 某些特殊的嵌入方式
    const hasPdfEmbed = !!document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
    return hasPdfExtension || hasPdfType || hasPdfEmbed;
  };

  // 1. 立即注入遮罩样式
  const injectStyle = () => {
    if (document.getElementById('pdf-filter-initial-style')) return;
    const style = document.createElement('style');
    style.id = 'pdf-filter-initial-style';
    style.innerHTML = `
      html, body { background: #222 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      #pdf-loading-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        transition: opacity ${FADE_DURATION}ms ease;
        background: #222; /* 初始底色 */
      }
      .loading-spinner {
        color: white; font-family: 'Segoe UI', sans-serif; font-size: 18px; font-weight: 300;
        z-index: 2147483648;
        display: ${SHOW_LOADING_TEXT ? 'block' : 'none'};
      }
    `;
    document.documentElement.appendChild(style);
  };

  // 2. 注入遮罩
  const injectOverlay = () => {
    if (document.getElementById('pdf-loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdf-loading-overlay';
    overlay.style.opacity = OVERLAY_ALPHA;
    overlay.innerHTML = '<div class="loading-spinner">Initializing Eye Protection...</div>';
    document.documentElement.appendChild(overlay);
  };

  // 如果 URL 看起来像 PDF，直接先挡住屏幕，不等任何异步回调
  if (window.location.href.split(/[?#]/)[0].toLowerCase().endsWith('.pdf')) {
    injectStyle();
    injectOverlay();
  }

  // 3. 强力探测循环
  let checkCount = 0;
  const maxChecks = 80; // 50ms * 80 = 4秒探测期
  const detectionInterval = setInterval(() => {
    checkCount++;
    
    const isPdf = isLikelyPdf();
    
    // 只要探测到是 PDF，确保遮罩已挂载
    if (isPdf) {
      injectStyle();
      injectOverlay();
    }

    // 检查库是否就绪并开始处理
    if (isPdf && !processingStarted) {
      const libsReady = typeof PDFLib !== 'undefined' && typeof THREE !== 'undefined' && typeof VANTA !== 'undefined';
      if (libsReady) {
        processingStarted = true;
        clearInterval(detectionInterval);
        processPdf();
      }
    }

    // 超时处理
    if (checkCount >= maxChecks) {
      clearInterval(detectionInterval);
      if (!processingStarted) {
        const overlay = document.getElementById('pdf-loading-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), FADE_DURATION);
        }
      }
    }
  }, 50);

  async function processPdf() {
    chrome.storage.sync.get(['pdfBgColor', 'pdfFilterEnabled'], async (result) => {
      const isEnabled = result.pdfFilterEnabled !== false;
      const bgColor = result.pdfBgColor || '#d3d3d3';

      if (!isEnabled) {
        const overlay = document.getElementById('pdf-loading-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
            document.getElementById('pdf-filter-initial-style')?.remove();
          }, FADE_DURATION);
        }
        return;
      }

      // Vanta 效果初始化
      if (typeof VANTA !== 'undefined' && VANTA.WAVES) {
        try {
          vantaEffect = VANTA.WAVES({
            el: "#pdf-loading-overlay",
            mouseControls: true,
            touchControls: true,
            color: parseInt(bgColor.replace('#', ''), 16),
            shininess: 35,
            waveHeight: 15,
            waveSpeed: 0.6
          });
        } catch (err) {
          const overlay = document.getElementById('pdf-loading-overlay');
          if (overlay) overlay.style.backgroundColor = bgColor;
        }
      }

      console.log('[PDF-Filter] Fetching original document...');
      chrome.runtime.sendMessage({ type: 'FETCH_PDF', url: window.location.href }, async (response) => {
        if (!response || !response.success) {
          console.error('[PDF-Filter] Fetch failed:', response?.error);
          cleanup();
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
          
          // 等待 DOM 准备就绪
          const waitForBody = setInterval(() => {
            if (document.body) {
              clearInterval(waitForBody);
              injectFinalPdf(newUrl, bgColor);
            }
          }, 50);

        } catch (e) {
          console.error('[PDF-Filter] Processing Error:', e);
          cleanup();
        }
      });
    });
  }

  function injectFinalPdf(url, bgColor) {
    const embed = document.createElement('embed');
    embed.src = url;
    embed.type = 'application/pdf';
    embed.style.cssText = 'width:100vw; height:100vh; border:none; display:block;';
    
    document.body.innerHTML = '';
    document.body.appendChild(embed);

    setTimeout(() => {
      const overlay = document.getElementById('pdf-loading-overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none'; 
        setTimeout(() => {
          if (vantaEffect) vantaEffect.destroy();
          overlay.remove();
          const style = document.getElementById('pdf-filter-initial-style');
          if (style) style.innerHTML = `html, body { background: ${bgColor} !important; margin: 0; overflow: hidden; }`;
        }, FADE_DURATION); 
      }
    }, FADE_START_DELAY);
  }

  function cleanup() {
    if (vantaEffect) vantaEffect.destroy();
    const overlay = document.getElementById('pdf-loading-overlay');
    if (overlay) overlay.remove();
    document.getElementById('pdf-filter-initial-style')?.remove();
  }
})();

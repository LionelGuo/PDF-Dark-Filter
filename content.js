(async function() {
  if (window.location.protocol === 'blob:') return;

  // --- 配置变量 ---
  const FADE_START_DELAY = 500; 
  const FADE_DURATION = 1500;    
  const OVERLAY_ALPHA = 1.0;      
  const SHOW_LOADING_TEXT = false; 
  // --------------

  let vantaEffect = null;
  let processingStarted = false;
  let isOverlayInjected = false;

  const isLikelyPdf = () => {
    const url = window.location.href.split(/[?#]/)[0].toLowerCase();
    return url.endsWith('.pdf') || 
           document.contentType === 'application/pdf' || 
           !!document.querySelector('embed[type="application/pdf"]');
  };

  const injectOverlayOnce = () => {
    if (isOverlayInjected) return;
    isOverlayInjected = true;

    const style = document.createElement('style');
    style.id = 'pdf-filter-initial-style';
    style.innerHTML = `
      html, body { background: #222 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      #pdf-loading-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        transition: opacity ${FADE_DURATION}ms ease;
        background: #222;
      }
    `;
    document.documentElement.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'pdf-loading-overlay';
    overlay.style.opacity = OVERLAY_ALPHA;
    overlay.innerHTML = `<div style="display: ${SHOW_LOADING_TEXT ? 'block' : 'none'}; color: white; font-family: sans-serif;">Initializing...</div>`;
    document.documentElement.appendChild(overlay);
  };

  // 立即尝试拦截
  if (window.location.href.toLowerCase().includes('.pdf')) {
    injectOverlayOnce();
  }

  /**
   * 极简色彩优化算法：线性插值混合 (Lerp)
   * 性能消耗极低，避免了 HSL 转换带来的逻辑分支
   */
  const getOptimizedVantaColor = (hex) => {
    // 解析用户颜色
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // 预设中性灰基准 (targetL = 0.55 对应约 140/255)
    const baseGray = 140;
    // 低饱和度混合因子 (targetS = 0.25 对应约 25% 的颜色偏移)
    const mix = 0.25;

    // 线性混合：result = base * (1 - mix) + user * mix
    const finalR = Math.round(baseGray * (1 - mix) + r * mix);
    const finalG = Math.round(baseGray * (1 - mix) + g * mix);
    const finalB = Math.round(baseGray * (1 - mix) + b * mix);

    return (finalR << 16) | (finalG << 8) | finalB;
  };

  const detectionInterval = setInterval(() => {
    const isPdf = isLikelyPdf();
    if (isPdf) injectOverlayOnce();

    if (isPdf && !processingStarted) {
      const libsReady = typeof PDFLib !== 'undefined' && typeof THREE !== 'undefined' && typeof VANTA !== 'undefined';
      if (libsReady) {
        processingStarted = true;
        clearInterval(detectionInterval);
        processPdf();
      }
    }
  }, 100); // 降低探测频率至 100ms 以释放 CPU

  async function processPdf() {
    chrome.storage.sync.get(['pdfBgColor', 'pdfFilterEnabled', 'localOnly', 'paperTexture', 'textureIntensity', 'textureScale'], async (result) => {
      const isEnabled = result.pdfFilterEnabled !== false;
      const bgColor = result.pdfBgColor || '#d3d3d3';
      const localOnly = result.localOnly === true;
      const useTexture = result.paperTexture === true;
      const textureIntensity = parseInt(result.textureIntensity || 4);
      const textureScale = parseInt(result.textureScale || 100);

      if (!isEnabled || (localOnly && window.location.protocol !== 'file:')) {
        cleanup();
        return;
      }

      // 启动 Vanta
      if (typeof VANTA !== 'undefined' && VANTA.WAVES) {
        try {
          vantaEffect = VANTA.WAVES({
            el: "#pdf-loading-overlay",
            mouseControls: true,
            touchControls: true,
            color: getOptimizedVantaColor(bgColor), // 使用超轻量级计算
            shininess: 25,
            waveHeight: 20,
            waveSpeed: 0.6,
            zoom: 0.9
          });
        } catch (err) {
          const overlay = document.getElementById('pdf-loading-overlay');
          if (overlay) overlay.style.backgroundColor = '#888';
        }
      }

      chrome.runtime.sendMessage({ type: 'FETCH_PDF', url: window.location.href }, async (response) => {
        if (!response || !response.success) {
          cleanup();
          return;
        }

        try {
          // 使用高效的原生流处理
          const res = await fetch(response.data);
          const arrayBuffer = await res.arrayBuffer();

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
          
          // 确保在主线程空闲时注入 PDF
          requestAnimationFrame(() => {
            const waitForBody = setInterval(() => {
              if (document.body) {
                clearInterval(waitForBody);
                injectFinalPdf(newUrl, bgColor, useTexture, textureIntensity, textureScale);
              }
            }, 50);
          });

        } catch (e) {
          console.error('[PDF-Filter] Error:', e);
          cleanup();
        }
      });
    });
  }

  function injectFinalPdf(url, bgColor, useTexture, textureIntensity, textureScale) {
    const container = document.createElement('div');
    container.style.cssText = 'position:relative; width:100vw; height:100vh; overflow:hidden;';

    const embed = document.createElement('embed');
    embed.src = url;
    embed.type = 'application/pdf';
    embed.style.cssText = 'width:100%; height:100%; border:none; display:block;';
    container.appendChild(embed);

    if (useTexture) {
      const texture = document.createElement('div');
      texture.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100; pointer-events: none; opacity: ${textureIntensity / 100};
        background-image: url("${chrome.runtime.getURL('paper.jpg')}");
        background-repeat: repeat; background-size: ${textureScale}%;
        mix-blend-mode: multiply;
      `;
      container.appendChild(texture);
    }

    document.body.innerHTML = '';
    document.body.appendChild(container);

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
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        document.getElementById('pdf-filter-initial-style')?.remove();
      }, FADE_DURATION);
    }
  }
})();

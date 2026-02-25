(async function() {
  if (window.location.protocol === 'blob:') return;

  const FADE_START_DELAY = 500; 
  const FADE_DURATION = 1500;    
  const OVERLAY_ALPHA = 1.0;      
  const SHOW_LOADING_TEXT = false; 

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
      @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
      html, body { background: #222 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      #pdf-loading-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        transition: opacity ${FADE_DURATION}ms ease;
        background: #222;
      }
      .loading-branding {
        position: absolute;
        bottom: 50px;
        right: 50px;
        display: flex;
        user-select: none;
        opacity: 0;
        animation: branding-settle 0.4s ease-out forwards;
        animation-delay: 0.1s;
      }
      .loading-branding span {
        font-family: 'Anton', 'Arial Black', sans-serif;
        font-size: 60px;
        text-shadow: -10px 5px 20px rgba(0, 0, 0, 0.5);
        color: white;
        letter-spacing: 0em;
        line-height: 1;
        display: inline-block;
      }
      @keyframes branding-settle {
        from { opacity: 0; }
        to { opacity: 0.5; }
      }
    `;
    document.documentElement.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'pdf-loading-overlay';
    overlay.style.opacity = OVERLAY_ALPHA;
    
    // 将文字拆分为 span 以实现层叠阴影效果
    const text = "LOADING FILTERS";
    const spanWrappedText = text.split('').map(char => 
      `<span>${char === ' ' ? '&nbsp;' : char}</span>`
    ).join('');

    overlay.innerHTML = `
      <div style="display: ${SHOW_LOADING_TEXT ? 'block' : 'none'}; color: white; font-family: sans-serif;">Initializing...</div>
      <div class="loading-branding">${spanWrappedText}</div>
    `;
    document.documentElement.appendChild(overlay);
  };

  if (window.location.href.toLowerCase().includes('.pdf')) {
    injectOverlayOnce();
  }

  const getOptimizedVantaColor = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const baseGray = 130;
    const mix = 0.25;
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
  }, 100);

  async function processPdf() {
    chrome.storage.sync.get([
      'mainSwitch',
      'colorFilterEnabled',
      'pdfBgColor', 
      'localOnly', 
      'paperTexture', 
      'textureIntensity', 
      'textureScale',
      'compatibilityMode'
    ], async (result) => {
      const isGlobalEnabled = result.mainSwitch !== false;
      const isLocalOnly = result.localOnly === true;
      const isLocalFile = window.location.protocol === 'file:';

      if (!isGlobalEnabled || (isLocalOnly && !isLocalFile)) {
        cleanup();
        return;
      }

      const useColorFilter = result.colorFilterEnabled !== false;
      const useTexture = result.paperTexture !== false;
      const isCompMode = result.compatibilityMode === true;
      const bgColor = result.pdfBgColor || '#b9b5b1';
      const textureIntensity = parseInt(result.textureIntensity || 25);
      const textureScale = parseInt(result.textureScale || 100);

      if (!useColorFilter && !useTexture) {
        cleanup();
        return;
      }

      if (typeof VANTA !== 'undefined' && VANTA.WAVES) {
        try {
          vantaEffect = VANTA.WAVES({
            el: "#pdf-loading-overlay",
            mouseControls: true,
            touchControls: true,
            color: getOptimizedVantaColor(bgColor),
            shininess: 30,
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
          const res = await fetch(response.data);
          const arrayBuffer = await res.arrayBuffer();

          const { PDFDocument, rgb, BlendMode } = PDFLib;
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          
          // 仅在 非兼容模式 且 开启色彩滤镜 时，物理修改 PDF
          if (!isCompMode && useColorFilter) {
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
          }

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const newUrl = URL.createObjectURL(blob);
          
          requestAnimationFrame(() => {
            const waitForBody = setInterval(() => {
              if (document.body) {
                clearInterval(waitForBody);
                injectFinalPdf(newUrl, bgColor, useTexture, textureIntensity, textureScale, isCompMode, useColorFilter);
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

  function injectFinalPdf(url, bgColor, useTexture, textureIntensity, textureScale, isCompMode, useColorFilter) {
    const container = document.createElement('div');
    container.style.cssText = 'position:relative; width:100vw; height:100vh; overflow:hidden;';

    const embed = document.createElement('embed');
    embed.src = url;
    embed.type = 'application/pdf';
    embed.style.cssText = 'width:100%; height:100%; border:none; display:block;';
    container.appendChild(embed);

    // 渲染颜色滤镜层 (仅在兼容模式且开启滤镜时)
    if (isCompMode && useColorFilter) {
      const colorOverlay = document.createElement('div');
      colorOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100; pointer-events: none;
        background-color: ${bgColor};
        mix-blend-mode: multiply;
        opacity: 1;
      `;
      container.appendChild(colorOverlay);
    }

    // 渲染纸张纹理层 (只要开启纹理就渲染，不论是否兼容模式)
    if (useTexture) {
      const textureOverlay = document.createElement('div');
      textureOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 101; pointer-events: none;
        background-image: url("${chrome.runtime.getURL('paper.jpg')}");
        background-repeat: repeat;
        background-size: ${textureScale}%;
        mix-blend-mode: multiply;
        opacity: ${textureIntensity / 100};
      `;
      container.appendChild(textureOverlay);
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

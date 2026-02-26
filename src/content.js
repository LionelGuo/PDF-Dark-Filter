(async function() {
  if (window.location.protocol === 'blob:') return;

  const FADE_START_DELAY = 600; 
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
    
    // Split text into spans to achieve stacked shadow effects
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
    const baseGray = 100;
    const mix = 0.35;
    const finalR = Math.round(baseGray * (1 - mix) + r * mix);
    const finalG = Math.round(baseGray * (1 - mix) + g * mix);
    const finalB = Math.round(baseGray * (1 - mix) + b * mix);
    return (finalR << 16) | (finalG << 8) | finalB;
  };

  const initDetection = () => {
    if (processingStarted) return;
    
    if (isLikelyPdf()) {
      console.log('[PDF-Filter] PDF detected, initializing...');
      injectOverlayOnce();
      processingStarted = true;
      
      chrome.storage.sync.get([
        'mainSwitch',
        'colorFilterEnabled',
        'pdfBgColor', 
        'localOnly', 
        'paperTexture', 
        'textureIntensity', 
        'textureScale',
        'compatibilityMode',
        'loadingAnimation'
      ], (result) => {
        const isGlobalEnabled = result.mainSwitch !== false;
        const isLocalOnly = result.localOnly === true;
        const isLocalFile = window.location.protocol === 'file:';
        const isCompMode = result.compatibilityMode === true;
        const useAnimation = result.loadingAnimation !== false;

        if (!isGlobalEnabled || (isLocalOnly && !isLocalFile)) {
          cleanup();
          return;
        }

        const filesToLoad = [];
        if (!isCompMode) {
          if (useAnimation) {
            filesToLoad.push('lib/three.min.js');
            filesToLoad.push('lib/vanta.waves.min.js');
          }
        }

        chrome.runtime.sendMessage({ type: 'LOAD_LIBRARIES', files: filesToLoad }, (response) => {
          if (response && response.success) {
            if (filesToLoad.length > 0) {
              console.log('[PDF-Filter] Library injection requested:', filesToLoad);
              let attempts = 0;
              const checkLibs = setInterval(() => {
                attempts++;
                const three = (typeof THREE !== 'undefined' || !useAnimation);
                const vanta = (typeof VANTA !== 'undefined' || !useAnimation);

                if (three && vanta) {
                  console.log('[PDF-Filter] Required libraries ready after', attempts * 30, 'ms');
                  clearInterval(checkLibs);
                  processPdf(result);
                } else if (attempts > 100) {
                  console.error('[PDF-Filter] Library loading timeout.');
                  clearInterval(checkLibs);
                  cleanup();
                }
              }, 30);
            } else {
              console.log('[PDF-Filter] No libraries needed.');
              processPdf(result);
            }
          } else {
            console.error('[PDF-Filter] Failed to load libraries:', response?.error);
            processingStarted = false;
            cleanup();
          }
        });
      });
    }
  };

  // Immediate check
  initDetection();

  // Watch for dynamically added embed/object tags
  const observer = new MutationObserver((mutations) => {
    if (!processingStarted) initDetection();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  async function processPdf(result) {
    // Stop observing once we start processing
    observer.disconnect();
    
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

    if (!isCompMode && result.loadingAnimation !== false && typeof VANTA !== 'undefined' && VANTA.WAVES) {
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

    const getPdfData = async () => {
      try {
        console.log('[PDF-Filter] Attempting direct fetch...');
        const res = await fetch(window.location.href);
        const buffer = await res.arrayBuffer();
        return new Uint8Array(buffer);
      } catch (e) {
        console.log('[PDF-Filter] Direct fetch failed (CORS?), falling back to background...');
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'FETCH_PDF', url: window.location.href }, (response) => {
            if (response && response.success && response.data) {
              const binary = atob(response.data);
              const uint8 = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                uint8[i] = binary.charCodeAt(i);
              }
              resolve(uint8);
            } else {
              reject(new Error(response?.error || 'Background fetch failed'));
            }
          });
        });
      }
    };

    getPdfData().then(async (uint8) => {
      console.log('[PDF-Filter] PDF data ready. Size:', uint8.length);
      
      try {
        if (!isCompMode && useColorFilter) {
          console.log('[PDF-Filter] Preparing Worker...');
          const workerUrl = chrome.runtime.getURL('src/pdf-worker.js');
          const workerResponse = await fetch(workerUrl);
          const workerCode = await workerResponse.text();
          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));
          
          worker.postMessage({ 
            pdfData: uint8, 
            bgColor: bgColor,
            useColorFilter: true,
            libUrl: chrome.runtime.getURL('lib/pdf-lib.min.js')
          }, [uint8.buffer]);

          worker.onmessage = function(e) {
            if (e.data.success) {
              const blobUrl = URL.createObjectURL(new Blob([e.data.pdfBytes], { type: 'application/pdf' }));
              finishProcessing(blobUrl);
            } else {
              console.error('[PDF-Filter] Worker Error:', e.data.error);
              cleanup();
            }
            worker.terminate();
          };
          worker.onerror = (err) => {
            console.error('[PDF-Filter] Worker Thread Error:', err);
            cleanup();
          };
        } else {
          console.log('[PDF-Filter] Using CSS overlay (Compatibility Mode)...');
          const blobUrl = URL.createObjectURL(new Blob([uint8], { type: 'application/pdf' }));
          finishProcessing(blobUrl);
        }

        function finishProcessing(finalUrl) {
          requestAnimationFrame(() => {
            const waitForBody = setInterval(() => {
              if (document.body) {
                clearInterval(waitForBody);
                injectFinalPdf(finalUrl, bgColor, useTexture, textureIntensity, textureScale, isCompMode, useColorFilter);
              }
            }, 50);
          });
        }
      } catch (e) {
        console.error('[PDF-Filter] Processing Error:', e);
        cleanup();
      }
    }).catch(err => {
      console.error('[PDF-Filter] Data retrieval failed:', err);
      cleanup();
    });
  }

  function injectFinalPdf(url, bgColor, useTexture, textureIntensity, textureScale, isCompMode, useColorFilter) {
    console.log('[PDF-Filter] Injecting final PDF. Mode:', isCompMode ? 'Compatibility' : 'Native');
    
    const container = document.createElement('div');
    container.id = 'pdf-filter-container';
    container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      overflow: hidden; z-index: 2147483646;
      background-color: white;
      isolation: isolate;
    `;

    const embed = document.createElement('embed');
    embed.src = url;
    embed.type = 'application/pdf';
    embed.style.cssText = 'width:100%; height:100%; border:none; display:block; transform: translateZ(0);';
    container.appendChild(embed);

    if (isCompMode && useColorFilter) {
      const colorOverlay = document.createElement('div');
      colorOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100; pointer-events: none;
        background-color: ${bgColor};
        mix-blend-mode: multiply;
      `;
      container.appendChild(colorOverlay);
    }

    if (useTexture) {
      const textureOverlay = document.createElement('div');
      textureOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 101; pointer-events: none;
        background-image: url("${chrome.runtime.getURL('assets/textures/paper.jpg')}");
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
          if (style) {
            style.innerHTML = `html, body { background: ${bgColor} !important; margin: 0; overflow: hidden; }`;
          }
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOAD_LIBRARIES') {
    const tabId = sender.tab.id;
    const filesToInject = request.files || [
      'lib/three.min.js',
      'lib/vanta.waves.min.js',
      'lib/pdf-lib.min.js'
    ];
    
    if (filesToInject.length === 0) {
      sendResponse({ success: true });
      return true;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [sender.frameId] },
      files: filesToInject
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('Failed to inject libraries:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.type === 'FETCH_PDF') {
    fetch(request.url)
      .then(response => response.arrayBuffer())
      .then(buffer => {
        // Convert ArrayBuffer to Uint8Array for messaging stability
        const uint8 = new Uint8Array(buffer);
        // We send it as a regular array if structured clone fails, but Uint8Array is supported
        sendResponse({ success: true, data: Array.from(uint8) });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; 
  }
});

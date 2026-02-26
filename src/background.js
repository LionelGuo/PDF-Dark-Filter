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
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Convert to Base64 string for reliable cross-context transfer
          const base64data = reader.result.split(',')[1];
          sendResponse({ success: true, data: base64data });
        };
        reader.onerror = (err) => {
          sendResponse({ success: false, error: 'FileReader error' });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; 
  }
});

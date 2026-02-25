chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_PDF') {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        // 使用原生的 FileReader 转换为 DataURL
        // 这是浏览器底层实现的异步转换，性能极高且不会造成卡顿
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, data: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'FileReader failed' });
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

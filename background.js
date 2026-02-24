chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_PDF') {
    fetch(request.url)
      .then(response => response.arrayBuffer())
      .then(buffer => {
        // 将 ArrayBuffer 转换为 Base64 字符串传输，因为消息传递不支持直接传 ArrayBuffer
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        sendResponse({ success: true, data: base64 });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持通道开启以进行异步响应
  }
});

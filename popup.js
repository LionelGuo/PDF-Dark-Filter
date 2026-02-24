document.addEventListener('DOMContentLoaded', () => {
  const colorPicker = document.getElementById('bgColor');
  const enabledCheckbox = document.getElementById('enabled');

  // Load saved settings
  chrome.storage.sync.get(['pdfBgColor', 'pdfFilterEnabled'], (result) => {
    if (result.pdfBgColor) {
      colorPicker.value = result.pdfBgColor;
    }
    if (result.pdfFilterEnabled !== undefined) {
      enabledCheckbox.checked = result.pdfFilterEnabled;
    }
  });

  // Save settings on change
  const saveSettings = () => {
    chrome.storage.sync.set({
      pdfBgColor: colorPicker.value,
      pdfFilterEnabled: enabledCheckbox.checked
    });
  };

  colorPicker.addEventListener('input', saveSettings);
  enabledCheckbox.addEventListener('change', saveSettings);
});

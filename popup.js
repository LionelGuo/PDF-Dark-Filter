document.addEventListener('DOMContentLoaded', () => {
  const colorPicker = document.getElementById('bgColor');
  const enabledCheckbox = document.getElementById('enabled');
  const localOnlyCheckbox = document.getElementById('localOnly');
  const paperTextureCheckbox = document.getElementById('paperTexture');
  const textureIntensitySlider = document.getElementById('textureIntensity');
  const textureScaleSlider = document.getElementById('textureScale');

  // Load saved settings
  chrome.storage.sync.get(['pdfBgColor', 'pdfFilterEnabled', 'localOnly', 'paperTexture', 'textureIntensity', 'textureScale'], (result) => {
    if (result.pdfBgColor) {
      colorPicker.value = result.pdfBgColor;
    }
    if (result.pdfFilterEnabled !== undefined) {
      enabledCheckbox.checked = result.pdfFilterEnabled;
    }
    if (result.localOnly !== undefined) {
      localOnlyCheckbox.checked = result.localOnly;
    }
    if (result.paperTexture !== undefined) {
      paperTextureCheckbox.checked = result.paperTexture;
    }
    if (result.textureIntensity !== undefined) {
      textureIntensitySlider.value = result.textureIntensity;
    }
    if (result.textureScale !== undefined) {
      textureScaleSlider.value = result.textureScale;
    }
  });

  // Save settings on change
  const saveSettings = () => {
    chrome.storage.sync.set({
      pdfBgColor: colorPicker.value,
      pdfFilterEnabled: enabledCheckbox.checked,
      localOnly: localOnlyCheckbox.checked,
      paperTexture: paperTextureCheckbox.checked,
      textureIntensity: textureIntensitySlider.value,
      textureScale: textureScaleSlider.value
    });
  };

  colorPicker.addEventListener('input', saveSettings);
  enabledCheckbox.addEventListener('change', saveSettings);
  localOnlyCheckbox.addEventListener('change', saveSettings);
  paperTextureCheckbox.addEventListener('change', saveSettings);
  textureIntensitySlider.addEventListener('input', saveSettings);
  textureScaleSlider.addEventListener('input', saveSettings);
});

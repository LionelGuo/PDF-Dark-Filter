document.addEventListener('DOMContentLoaded', () => {
  const mainSwitch = document.getElementById('mainSwitch');
  const subControls = document.getElementById('subControls');
  
  const colorFilterCheckbox = document.getElementById('colorFilterEnabled');
  const colorPicker = document.getElementById('bgColor');
  
  const paperTextureCheckbox = document.getElementById('paperTexture');
  const textureIntensitySlider = document.getElementById('textureIntensity');
  const textureIntensityValue = document.getElementById('intensityValue');
  const textureScaleSlider = document.getElementById('textureScale');
  const textureScaleValue = document.getElementById('scaleValue');
  
  const compatibilityModeCheckbox = document.getElementById('compatibilityMode');
  const loadingAnimationCheckbox = document.getElementById('loadingAnimation');
  const localOnlyCheckbox = document.getElementById('localOnly');

  let saveTimeout = null;

  // Update sub-control availability state and numerical displays
  const updateUIState = () => {
    // Master switch control
    if (mainSwitch.checked) {
      subControls.classList.remove('disabled');
    } else {
      subControls.classList.add('disabled');
    }
    
    // Paper texture settings area control
    const textureSettings = document.getElementById('textureSettings');
    if (paperTextureCheckbox.checked) {
      textureSettings.style.opacity = '1';
      textureSettings.style.pointerEvents = 'auto';
    } else {
      textureSettings.style.opacity = '0.5';
      textureSettings.style.pointerEvents = 'none';
    }

    // Real-time synchronization of displayed values
    textureIntensityValue.textContent = textureIntensitySlider.value;
    textureScaleValue.textContent = textureScaleSlider.value;

    // Loading Animation logic: Disable when Compatibility Mode is on
    const animationGroup = document.getElementById('animationGroup');
    const animationCheckbox = document.getElementById('loadingAnimation');
    const animationNote = document.getElementById('animationNote');

    if (compatibilityModeCheckbox.checked) {
      animationGroup.style.opacity = '0.5';
      animationGroup.style.pointerEvents = 'none';
      animationCheckbox.disabled = true;
      animationNote.style.display = 'block';
    } else {
      animationGroup.style.opacity = '1';
      animationGroup.style.pointerEvents = 'auto';
      animationCheckbox.disabled = false;
    }
  };

  // Unified save function
  const saveSettings = () => {
    chrome.storage.sync.set({
      mainSwitch: mainSwitch.checked,
      colorFilterEnabled: colorFilterCheckbox.checked,
      pdfBgColor: colorPicker.value,
      localOnly: localOnlyCheckbox.checked,
      paperTexture: paperTextureCheckbox.checked,
      textureIntensity: parseInt(textureIntensitySlider.value),
      textureScale: parseInt(textureScaleSlider.value),
      compatibilityMode: compatibilityModeCheckbox.checked,
      loadingAnimation: loadingAnimationCheckbox.checked
    });
  };

  // Debounced save: for controls that trigger continuously, like sliders
  const debouncedSave = () => {
    updateUIState(); // Update numerical display immediately for better responsiveness
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveSettings();
    }, 200); // Write to storage after 200ms of inactivity
  };

  // Load settings
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
    if (result.mainSwitch !== undefined) mainSwitch.checked = result.mainSwitch;
    if (result.colorFilterEnabled !== undefined) colorFilterCheckbox.checked = result.colorFilterEnabled;
    if (result.pdfBgColor) colorPicker.value = result.pdfBgColor;
    if (result.localOnly !== undefined) localOnlyCheckbox.checked = result.localOnly;
    if (result.paperTexture !== undefined) paperTextureCheckbox.checked = result.paperTexture;
    if (result.compatibilityMode !== undefined) compatibilityModeCheckbox.checked = result.compatibilityMode;
    if (result.loadingAnimation !== undefined) loadingAnimationCheckbox.checked = result.loadingAnimation;
    
    if (result.textureIntensity !== undefined) {
      textureIntensitySlider.value = result.textureIntensity;
    }
    if (result.textureScale !== undefined) {
      textureScaleSlider.value = result.textureScale;
    }
    
    updateUIState();
  });

  // Bind events
  [mainSwitch, colorFilterCheckbox, paperTextureCheckbox, localOnlyCheckbox, compatibilityModeCheckbox, loadingAnimationCheckbox].forEach(el => {
    el.addEventListener('change', () => {
      updateUIState();
      saveSettings();
    });
  });
  
  colorPicker.addEventListener('input', () => {
    saveSettings();
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.value = btn.dataset.color;
      saveSettings();
    });
  });

  [textureIntensitySlider, textureScaleSlider].forEach(el => {
    el.addEventListener('input', debouncedSave);
  });

  // Apply and Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    saveSettings();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});

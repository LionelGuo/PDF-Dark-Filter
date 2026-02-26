document.addEventListener('DOMContentLoaded', () => {
  const mainSwitch = document.getElementById('mainSwitch');
  const subControls = document.getElementById('subControls');
  
  const colorFilterCheckbox = document.getElementById('colorFilterEnabled');
  const colorPicker = document.getElementById('bgColor');
  
  const hueSlider = document.getElementById('hueSlider');
  const hueValue = document.getElementById('hueValue');
  const satSlider = document.getElementById('satSlider');
  const satValue = document.getElementById('satValue');
  const lightSlider = document.getElementById('lightSlider');
  const lightValue = document.getElementById('lightValue');

  const paperTextureCheckbox = document.getElementById('paperTexture');
  const textureIntensitySlider = document.getElementById('textureIntensity');
  const textureIntensityValue = document.getElementById('intensityValue');
  const textureScaleSlider = document.getElementById('textureScale');
  const textureScaleValue = document.getElementById('scaleValue');
  
  const compatibilityModeCheckbox = document.getElementById('compatibilityMode');
  const loadingAnimationCheckbox = document.getElementById('loadingAnimation');
  const localOnlyCheckbox = document.getElementById('localOnly');

  let saveTimeout = null;

  // Helper: Hex to HSL
  const hexToHsl = (hex) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  // Helper: HSL to Hex
  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const updateSlidersFromHex = (hex) => {
    const [h, s, l] = hexToHsl(hex);
    hueSlider.value = h;
    satSlider.value = s;
    lightSlider.value = l;
    updateUIState();
  };

  const updateHexFromSliders = () => {
    const h = parseInt(hueSlider.value);
    const s = parseInt(satSlider.value);
    const l = parseInt(lightSlider.value);
    colorPicker.value = hslToHex(h, s, l);
    updateUIState();
  };

  const updateSliderBackgrounds = () => {
    const h = hueSlider.value;
    const s = satSlider.value;
    const l = lightSlider.value;

    // Saturation gradient: from gray (0%) to full color (100%) at current hue and lightness
    satSlider.style.background = `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`;
    
    // Lightness gradient: from black to white through the current hue and saturation
    lightSlider.style.background = `linear-gradient(to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%))`;
  };

  const updatePaperSliderBackground = (el) => {
    const min = el.min || 0;
    const max = el.max || 100;
    const val = el.value;
    const percentage = (val - min) / (max - min) * 100;
    el.style.background = `linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%, var(--border-color) 100%)`;
  };

  // Update sub-control availability state and numerical displays
  const updateUIState = () => {
    // Master switch control
    if (mainSwitch.checked) {
      subControls.classList.remove('disabled');
    } else {
      subControls.classList.add('disabled');
    }
    
    // Color filter controls display
    hueValue.textContent = hueSlider.value;
    satValue.textContent = satSlider.value;
    lightValue.textContent = lightSlider.value;
    updateSliderBackgrounds();

    // Color filter settings area control
    const colorFilterSettings = document.getElementById('colorFilterSettings');
    if (colorFilterCheckbox.checked) {
      colorFilterSettings.style.opacity = '1';
      colorFilterSettings.style.pointerEvents = 'auto';
    } else {
      colorFilterSettings.style.opacity = '0.5';
      colorFilterSettings.style.pointerEvents = 'none';
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
    updatePaperSliderBackground(textureIntensitySlider);
    updatePaperSliderBackground(textureScaleSlider);

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
    if (result.pdfBgColor) {
      colorPicker.value = result.pdfBgColor;
      updateSlidersFromHex(result.pdfBgColor);
    } else {
      colorPicker.value = '#b6b3af';
      updateSlidersFromHex('#b6b3af');
    }
    if (result.localOnly !== undefined) localOnlyCheckbox.checked = result.localOnly;
    if (result.paperTexture !== undefined) paperTextureCheckbox.checked = result.paperTexture;
    if (result.compatibilityMode !== undefined) compatibilityModeCheckbox.checked = result.compatibilityMode;
    if (result.loadingAnimation !== undefined) loadingAnimationCheckbox.checked = result.loadingAnimation;
    
    if (result.textureIntensity !== undefined) {
      textureIntensitySlider.value = result.textureIntensity;
    } else {
      textureIntensitySlider.value = 50;
    }
    if (result.textureScale !== undefined) {
      textureScaleSlider.value = result.textureScale;
    } else {
      textureScaleSlider.value = 100;
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
    updateSlidersFromHex(colorPicker.value);
    saveSettings();
  });

  [hueSlider, satSlider, lightSlider].forEach(el => {
    el.addEventListener('input', () => {
      updateHexFromSliders();
      debouncedSave();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.value = btn.dataset.color;
      updateSlidersFromHex(btn.dataset.color);
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

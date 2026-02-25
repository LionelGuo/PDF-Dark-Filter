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
  const localOnlyCheckbox = document.getElementById('localOnly');

  let saveTimeout = null;

  // 更新子控件可用性状态和数字显示
  const updateUIState = () => {
    // 总开关控制
    if (mainSwitch.checked) {
      subControls.classList.remove('disabled');
    } else {
      subControls.classList.add('disabled');
    }
    
    // 纸张纹理设置区域控制
    const textureSettings = document.getElementById('textureSettings');
    if (paperTextureCheckbox.checked) {
      textureSettings.style.opacity = '1';
      textureSettings.style.pointerEvents = 'auto';
    } else {
      textureSettings.style.opacity = '0.5';
      textureSettings.style.pointerEvents = 'none';
    }

    // 实时同步显示的数值
    textureIntensityValue.textContent = textureIntensitySlider.value;
    textureScaleValue.textContent = textureScaleSlider.value;
  };

  // 统一保存函数
  const saveSettings = () => {
    chrome.storage.sync.set({
      mainSwitch: mainSwitch.checked,
      colorFilterEnabled: colorFilterCheckbox.checked,
      pdfBgColor: colorPicker.value,
      localOnly: localOnlyCheckbox.checked,
      paperTexture: paperTextureCheckbox.checked,
      textureIntensity: parseInt(textureIntensitySlider.value),
      textureScale: parseInt(textureScaleSlider.value),
      compatibilityMode: compatibilityModeCheckbox.checked
    });
  };

  // 防抖保存：针对滑动条等连续触发的控件
  const debouncedSave = () => {
    updateUIState(); // 立即更新数字显示，保持手感
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveSettings();
    }, 200); // 停止操作 200ms 后再写入存储
  };

  // 加载设置
  chrome.storage.sync.get([
    'mainSwitch',
    'colorFilterEnabled',
    'pdfBgColor', 
    'localOnly', 
    'paperTexture', 
    'textureIntensity', 
    'textureScale',
    'compatibilityMode'
  ], (result) => {
    if (result.mainSwitch !== undefined) mainSwitch.checked = result.mainSwitch;
    if (result.colorFilterEnabled !== undefined) colorFilterCheckbox.checked = result.colorFilterEnabled;
    if (result.pdfBgColor) colorPicker.value = result.pdfBgColor;
    if (result.localOnly !== undefined) localOnlyCheckbox.checked = result.localOnly;
    if (result.paperTexture !== undefined) paperTextureCheckbox.checked = result.paperTexture;
    if (result.compatibilityMode !== undefined) compatibilityModeCheckbox.checked = result.compatibilityMode;
    
    if (result.textureIntensity !== undefined) {
      textureIntensitySlider.value = result.textureIntensity;
    }
    if (result.textureScale !== undefined) {
      textureScaleSlider.value = result.textureScale;
    }
    
    updateUIState();
  });

  // 绑定事件
  [mainSwitch, colorFilterCheckbox, paperTextureCheckbox, localOnlyCheckbox, compatibilityModeCheckbox].forEach(el => {
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

  // 保存并刷新按钮
  document.getElementById('refreshBtn').addEventListener('click', () => {
    saveSettings();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});

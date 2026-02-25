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
      textureScale: parseInt(textureScaleSlider.value)
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
    'textureScale'
  ], (result) => {
    if (result.mainSwitch !== undefined) mainSwitch.checked = result.mainSwitch;
    if (result.colorFilterEnabled !== undefined) colorFilterCheckbox.checked = result.colorFilterEnabled;
    if (result.pdfBgColor) colorPicker.value = result.pdfBgColor;
    if (result.localOnly !== undefined) localOnlyCheckbox.checked = result.localOnly;
    if (result.paperTexture !== undefined) paperTextureCheckbox.checked = result.paperTexture;
    
    // 确保数值在合法范围内（处理旧版数据兼容性）
    if (result.textureIntensity !== undefined) {
      textureIntensitySlider.value = result.textureIntensity;
    }
    if (result.textureScale !== undefined) {
      textureScaleSlider.value = result.textureScale;
    }
    
    updateUIState();
  });

  // 绑定事件
  // 开关类：立即保存
  [mainSwitch, colorFilterCheckbox, paperTextureCheckbox, localOnlyCheckbox].forEach(el => {
    el.addEventListener('change', () => {
      updateUIState();
      saveSettings();
    });
  });
  
  // 颜色选择器：立即保存
  colorPicker.addEventListener('input', () => {
    saveSettings();
  });

  // 预设颜色按钮
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.value = btn.dataset.color;
      saveSettings();
    });
  });

  // 滑动条：防抖保存
  [textureIntensitySlider, textureScaleSlider].forEach(el => {
    el.addEventListener('input', debouncedSave);
  });
});

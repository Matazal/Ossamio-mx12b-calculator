class AudioContextManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playClick() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    // Synthesize a mechanical switch sound
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime); // Low fundamental freq
    osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);

    // Add a bit of white noise for the 'click' texture
    const bufferSize = this.audioCtx.sampleRate * 0.05;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;
    
    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.02);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioCtx.destination);
    
    noiseSource.start();
  }
}

const audioMgr = new AudioContextManager();

class Calculator {
  constructor() {
    this.displayEl = document.getElementById('display');
    this.indM = document.getElementById('ind-m');
    this.indE = document.getElementById('ind-e');
    
    this.memory = 0;
    this.currentValue = '0';
    this.previousValue = null;
    this.operator = null;
    this.newInputExpected = true;
    this.errorState = false;
    
    this.MAX_DIGITS = 12;
    
    this.bindEvents();
    this.updateDisplay();
  }

  bindEvents() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => {
        audioMgr.playClick();
        this.handleInput(btn.getAttribute('data-key'));
      });
    });

    document.addEventListener('keydown', (e) => {
      let keyMap = {
        'Escape': 'ac', 'Delete': 'c', 'Backspace': 'c',
        'Enter': '=', '=': '=', '+': '+', '-': '-', '*': '*', '/': '/',
        '.': '.', '%': '%', 'm': 'm+', 'n': 'm-'
      };
      
      let mappedKey = null;
      if (e.key >= '0' && e.key <= '9') {
        mappedKey = e.key;
      } else if (keyMap[e.key]) {
        mappedKey = keyMap[e.key];
      }
      
      if (mappedKey) {
        audioMgr.playClick();
        this.handleInput(mappedKey);
        // Visual feedback
        const btn = document.querySelector(`[data-key="${mappedKey}"]`);
        if (btn) {
          btn.classList.add('active-key');
          setTimeout(() => btn.classList.remove('active-key'), 100);
        }
      }
    });
  }

  handleInput(key) {
    if (this.errorState && key !== 'ac' && key !== 'c') return;

    if (key >= '0' && key <= '9') {
      this.inputDigit(key);
    } else if (key === '00') {
      this.inputDigit('0');
      this.inputDigit('0');
    } else if (key === '.') {
      this.inputDecimal();
    } else if (key === 'ac') {
      this.clearAll();
    } else if (key === 'c') {
      this.clearEntry();
    } else if (key === '+/-') {
      this.toggleSign();
    } else if (['+', '-', '*', '/'].includes(key)) {
      this.handleOperator(key);
    } else if (key === '=') {
      this.calculate();
    } else if (key === 'sqrt') {
      this.calculateSqrt();
    } else if (key === '%') {
      this.calculatePercentage();
    } else if (['mc', 'mr', 'm+', 'm-'].includes(key)) {
      this.handleMemory(key);
    }

    this.updateDisplay();
  }

  inputDigit(digit) {
    if (this.newInputExpected) {
      this.currentValue = digit;
      this.newInputExpected = false;
    } else {
      // Remove minus sign for length check
      const pureDigits = this.currentValue.replace(/[-.]/g, '');
      if (pureDigits.length < this.MAX_DIGITS) {
        this.currentValue = this.currentValue === '0' ? digit : this.currentValue + digit;
      }
    }
  }

  inputDecimal() {
    if (this.newInputExpected) {
      this.currentValue = '0.';
      this.newInputExpected = false;
    } else if (!this.currentValue.includes('.')) {
      this.currentValue += '.';
    }
  }

  clearAll() {
    this.currentValue = '0';
    this.previousValue = null;
    this.operator = null;
    this.newInputExpected = true;
    this.errorState = false;
    this.indE.classList.add('hidden');
  }

  clearEntry() {
    this.currentValue = '0';
    this.newInputExpected = true;
    this.errorState = false;
    this.indE.classList.add('hidden');
  }

  toggleSign() {
    if (this.currentValue !== '0') {
      this.currentValue = (parseFloat(this.currentValue) * -1).toString();
    }
  }

  handleOperator(op) {
    if (this.operator && !this.newInputExpected) {
      this.calculate();
    }
    this.previousValue = this.currentValue;
    this.operator = op;
    this.newInputExpected = true;
  }

  calculate() {
    if (!this.operator || !this.previousValue) return;

    const prev = parseFloat(this.previousValue);
    const curr = parseFloat(this.currentValue);
    let result = 0;

    switch (this.operator) {
      case '+': result = prev + curr; break;
      case '-': result = prev - curr; break;
      case '*': result = prev * curr; break;
      case '/': 
        if (curr === 0) {
          this.triggerError();
          return;
        }
        result = prev / curr; 
        break;
    }

    this.formatAndSetResult(result);
    this.operator = null;
    this.previousValue = null;
    this.newInputExpected = true;
  }

  calculateSqrt() {
    const curr = parseFloat(this.currentValue);
    if (curr < 0) {
      this.triggerError();
      return;
    }
    this.formatAndSetResult(Math.sqrt(curr));
    this.newInputExpected = true;
  }

  calculatePercentage() {
    if (!this.operator || !this.previousValue) return;
    
    const A = parseFloat(this.previousValue);
    const B = parseFloat(this.currentValue);
    let result = 0;

    switch (this.operator) {
      case '+': 
        // Addition mark-up: A + (A * B / 100)
        result = A + (A * B / 100); 
        break;
      case '-': 
        // Discount: A - (A * B / 100)
        result = A - (A * B / 100); 
        break;
      case '*': 
        // Standard multiplication: (A * B) / 100
        result = (A * B) / 100; 
        break;
      case '/': 
        // Division percentage: A / (B / 100)
        result = A / (B / 100); 
        break;
    }
    
    this.formatAndSetResult(result);
    this.operator = null;
    this.previousValue = null;
    this.newInputExpected = true;
  }

  handleMemory(key) {
    const curr = parseFloat(this.currentValue);
    switch (key) {
      case 'mc':
        this.memory = 0;
        this.indM.classList.add('hidden');
        break;
      case 'mr':
        this.currentValue = this.memory.toString();
        this.newInputExpected = true;
        break;
      case 'm+':
        this.memory += curr;
        this.indM.classList.remove('hidden');
        this.newInputExpected = true;
        break;
      case 'm-':
        this.memory -= curr;
        this.indM.classList.remove('hidden');
        this.newInputExpected = true;
        break;
    }
  }

  formatAndSetResult(num) {
    let resultStr = num.toString();
    
    // Check overflow
    const pureDigits = resultStr.replace(/[-.]/g, '').split('e')[0];
    if (pureDigits.length > this.MAX_DIGITS || Math.abs(num) > Math.pow(10, this.MAX_DIGITS) - 1) {
      // Very large numbers
      if (Math.abs(num) > Math.pow(10, this.MAX_DIGITS) - 1) {
        this.triggerError();
        return;
      }
      
      // Need to truncate decimal places
      const [intPart, decPart] = resultStr.split('.');
      if (intPart.length > this.MAX_DIGITS) {
        this.triggerError();
        return;
      }
      if (decPart) {
        const allowedDecimals = this.MAX_DIGITS - intPart.replace(/-/g, '').length;
        resultStr = num.toFixed(allowedDecimals);
        // Trim trailing zeros
        resultStr = parseFloat(resultStr).toString();
      }
    }
    
    this.currentValue = resultStr;
  }

  triggerError() {
    this.errorState = true;
    this.indE.classList.remove('hidden');
    this.currentValue = '0';
  }

  updateDisplay() {
    let displayStr = this.currentValue;
    
    // Add thousands separators for readability, avoiding decimals
    const parts = displayStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    this.displayEl.textContent = parts.join('.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Calculator();
});

class AudioContextManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playClick() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    // Synthesize a crisp, short mechanical click (like a tactile switch)
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    // High pitched snap that drops instantly to simulate the physical click
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.015);

    // Sharp attack and very rapid decay
    gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.015);

    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.015);
  }
}

const audioMgr = new AudioContextManager();

class ScientificCalculator {
  constructor() {
    this.mf = document.getElementById('display');
    this.ansMf = document.getElementById('answer-display');
    
    // Indicators
    this.indShift = document.getElementById('ind-shift');
    this.indAlpha = document.getElementById('ind-alpha');
    this.indM = document.getElementById('ind-m');
    this.indE = document.getElementById('ind-e');
    this.indDeg = document.getElementById('ind-deg');
    this.indRad = document.getElementById('ind-rad');

    this.shiftActive = false;
    this.alphaActive = false;
    this.errorState = false;
    this.angleMode = 'DEG';
    
    this.ans = 0;
    this.memory = 0;
    
    // Wait for custom elements to define (MathLive)
    customElements.whenDefined('math-field').then(() => {
      this.initComputeEngine();
      this.bindEvents();
      setTimeout(() => this.mf.focus(), 500);
    });
  }

  initComputeEngine() {
    // Check if ComputeEngine is available from CDN (initialized in index.html module script)
    if (window.ce) {
      this.ce = window.ce;
    } else {
      console.warn("ComputeEngine not loaded yet. Retrying...");
      setTimeout(() => this.initComputeEngine(), 200);
    }
  }

  bindEvents() {
    document.querySelectorAll('.btn').forEach(btn => {
      // Prevent button clicks from stealing focus from the math field
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      
      btn.addEventListener('click', (e) => {
        audioMgr.playClick();
        
        this.mf.focus();

        const key = btn.getAttribute('data-key');
        this.handleInput(key);
        
        // Visual feedback
        btn.classList.add('active-key');
        setTimeout(() => btn.classList.remove('active-key'), 100);
      });
    });
  }

  handleInput(key) {
    if (this.errorState && key !== 'ac') {
      return; // Ignore inputs until AC is pressed
    }

    switch(key) {
      // Navigation
      case 'up': this.mf.executeCommand('moveToPreviousLine'); break;
      case 'down': this.mf.executeCommand('moveToNextLine'); break;
      case 'left': this.mf.executeCommand('moveToPreviousChar'); break;
      case 'right': this.mf.executeCommand('moveToNextChar'); break;
      
      // Controls
      case 'ac':
        this.mf.setValue('');
        this.ansMf.setValue('');
        this.clearError();
        this.shiftActive = false;
        this.alphaActive = false;
        this.updateIndicators();
        break;
      case 'del':
        this.mf.executeCommand('deleteBackward');
        break;
      case 'shift':
        this.shiftActive = !this.shiftActive;
        this.updateIndicators();
        break;
      case 'alpha':
        this.alphaActive = !this.alphaActive;
        this.updateIndicators();
        break;
      
      case 'mode':
        this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
        this.indDeg.classList.toggle('hidden', this.angleMode !== 'DEG');
        this.indRad.classList.toggle('hidden', this.angleMode !== 'RAD');
        break;
      
      // Numbers & Basic Operators
      case '0': case '1': case '2': case '3': case '4': 
      case '5': case '6': case '7': case '8': case '9':
      case '.':
      case '+':
      case '-':
        this.mf.executeCommand(['insert', key]);
        break;
        
      case '*':
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', 'P\\left(#?, #?\\right)']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\times']); 
        }
        break;
      case '/': 
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', 'C\\left(#?, #?\\right)']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\div']); 
        }
        break;
        
      case 'exp':
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', '\\pi']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\times10^{#?}']);
        }
        break;
      case 'ans':
        this.mf.executeCommand(['insert', 'Ans']);
        break;
        
      // Scientific functions
      case 'abs': this.mf.executeCommand(['insert', '|#?|']); break;
      case 'frac': this.mf.executeCommand(['insert', '\\frac{#?}{#?}']); break;
      case 'sqrt': 
        if (this.shiftActive) {
           this.mf.executeCommand(['insert', '\\sqrt[3]{#?}']); 
           this.toggleShift(false);
        } else {
           this.mf.executeCommand(['insert', '\\sqrt{#?}']); 
        }
        break;
      case 'x2': 
        if (this.shiftActive) {
           this.mf.executeCommand(['insert', '^3']); 
           this.toggleShift(false);
        } else {
           this.mf.executeCommand(['insert', '^2']); 
        }
        break;
      case 'power': 
        if (this.shiftActive) {
           this.mf.executeCommand(['insert', '\\sqrt[#?]{#?}']); 
           this.toggleShift(false);
        } else {
           this.mf.executeCommand(['insert', '^{#?}']); 
        }
        break;
      case 'log': 
        if (this.shiftActive) {
           this.mf.executeCommand(['insert', '10^{#?}']); 
           this.toggleShift(false);
        } else {
           this.mf.executeCommand(['insert', '\\log_{10}\\left(#?\\right)']); 
        }
        break;
      case 'ln': 
        if (this.shiftActive) {
           this.mf.executeCommand(['insert', 'e^{#?}']); 
           this.toggleShift(false);
        } else {
           this.mf.executeCommand(['insert', '\\ln\\left(#?\\right)']); 
        }
        break;
      
      case 'sin': 
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', '\\arcsin\\left(#?\\right)']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\sin\\left(#?\\right)']); 
        }
        break;
      case 'cos': 
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', '\\arccos\\left(#?\\right)']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\cos\\left(#?\\right)']); 
        }
        break;
      case 'tan': 
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', '\\arctan\\left(#?\\right)']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '\\tan\\left(#?\\right)']); 
        }
        break;
      case 'inv': 
        if (this.shiftActive) {
          this.mf.executeCommand(['insert', '!']);
          this.toggleShift(false);
        } else {
          this.mf.executeCommand(['insert', '^{-1}']); 
        }
        break;
      
      case 'sd':
        // Custom feature: force decimal evaluation
        this.evaluateExpression(true);
        break;
        
      case '(': this.mf.executeCommand(['insert', '(']); break;
      case ')': this.mf.executeCommand(['insert', ')']); break;
      
      case 'm+':
      case 'm-':
        this.handleMemory(key);
        break;
      case 'mc':
        this.memory = 0;
        this.indM.classList.add('hidden');
        break;
      case 'mr':
        this.mf.executeCommand(['insert', this.memory.toString()]);
        break;
        
      case '=':
        this.evaluateExpression(false);
        break;
    }
  }

  toggleShift(state) {
    this.shiftActive = state;
    this.updateIndicators();
  }
  
  updateIndicators() {
    this.indShift.classList.toggle('hidden', !this.shiftActive);
    this.indAlpha.classList.toggle('hidden', !this.alphaActive);
  }

  preprocessLatex(latex) {
    if (!latex) return '';
    // Substitute Ans keyword with parentheses to ensure correct precedence (e.g. for negative values)
    latex = latex.replace(/Ans/g, `(${this.ans})`);
    
    // Simplify LaTeX brackets to make regex matching easier
    latex = latex.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
    
    // Strip any MathLive formatting tags around P and C just in case
    latex = latex.replace(/\\(?:operatorname|mathrm|text|mathit)\s*\{\s*([PC])\s*\}/g, '$1');
    
    // Match P(n, k) or C(n, k) robustly
    latex = latex.replace(/P\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g, '\\frac{$1!}{($1-$2)!}');
    latex = latex.replace(/C\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g, '\\binom{$1}{$2}');
    
    // Angle mode conversions
    if (this.angleMode === 'DEG') {
      latex = latex.replace(/\\(sin|cos|tan)\s*\\left\(/g, '\\$1\\left(\\frac{\\pi}{180}\\times(');
      latex = latex.replace(/\\(arcsin|arccos|arctan)\s*\\left\(/g, '\\frac{180}{\\pi}\\times\\$1\\left(');
    }
    
    return latex;
  }

  handleMemory(op) {
    if (!this.ce) return;
    try {
      let latex = this.mf.value;
      if (!latex || latex.includes('\\blacksquare') || latex.includes('#?')) {
        this.triggerError();
        return;
      }
      
      latex = this.preprocessLatex(latex);
      
      const expr = this.ce.parse(latex);
      const numValue = Number(expr.evaluate().N().valueOf());
      
      if (typeof numValue === 'number' && !isNaN(numValue) && isFinite(numValue)) {
        if (op === 'm+') this.memory += numValue;
        if (op === 'm-') this.memory -= numValue;
        this.indM.classList.remove('hidden');
      } else {
        this.triggerError();
      }
    } catch (e) {
      this.triggerError();
    }
  }

  evaluateExpression(forceDecimal = false) {
    if (!this.ce) return;
    
    try {
      let latex = this.mf.value;
      if (!latex) return;
      
      if (latex.includes('\\blacksquare') || latex.includes('#?')) {
        this.triggerError();
        return;
      }
      
      latex = this.preprocessLatex(latex);

      // Parse the expression with Compute Engine
      const expr = this.ce.parse(latex);
      const evaluated = expr.evaluate();
      
      // Force numeric approximation to extract standard JS number
      const numValue = Number(evaluated.N().valueOf());
      
      if (typeof numValue === 'number' && !isNaN(numValue) && isFinite(numValue)) {
         this.ans = numValue;
         
         if (forceDecimal) {
             let rounded = Math.round(numValue * 1e10) / 1e10;
             this.ansMf.setValue(rounded.toString());
         } else {
             // If exact form is available, use it, else round decimal
             if (evaluated.latex && !evaluated.latex.includes('Error')) {
                 this.ansMf.setValue(evaluated.latex);
             } else {
                 let rounded = Math.round(numValue * 1e10) / 1e10;
                 this.ansMf.setValue(rounded.toString());
             }
         }
         this.clearError();
      } else {
         this.triggerError();
      }
    } catch (err) {
      console.error(err);
      this.triggerError();
    }
  }

  triggerError() {
    this.errorState = true;
    this.indE.classList.remove('hidden');
  }

  clearError() {
    this.errorState = false;
    this.indE.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new ScientificCalculator();
});

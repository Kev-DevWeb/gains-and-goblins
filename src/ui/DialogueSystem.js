import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';

export default class DialogueSystem {
  constructor(scene) {
    this.scene = scene;
    this.isActive = false;
    this.lines = [];
    this.currentLineIndex = 0;
    this.onComplete = null;
    
    // Typewriter state
    this.typeTimer = null;
    this.charIndex = 0;
    this.isTyping = false;
    this.selectedChoiceIndex = 0;
    this.choiceButtons = [];
    this.choices = [];
    this._lineCompleteCallback = null;
    this._audioCtx = null;
    this._choiceJustConfirmed = false;

    this._createUI();
  }

  _createUI() {
    // We'll use HTML/CSS overlay for easier text wrapping and formatting,
    // since we already have a robust UI HTML layer.
    
    // Check if container already exists
    this.container = document.getElementById('dialogue-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'dialogue-container';
      this.container.className = 'dialogue-container hidden';
      
      this.nameEl = document.createElement('div');
      this.nameEl.className = 'dialogue-name';
      
      this.textEl = document.createElement('div');
      this.textEl.className = 'dialogue-text';
      
      this.choicesPanelEl = document.createElement('div');
      this.choicesPanelEl.className = 'dialogue-choices-panel hidden';

      this.choicesEl = document.createElement('div');
      this.choicesEl.className = 'dialogue-choices';
      this.choicesPanelEl.appendChild(this.choicesEl);
      
      this.indicatorEl = document.createElement('div');
      this.indicatorEl.className = 'dialogue-indicator';

      this.dialogueFooterEl = document.createElement('div');
      this.dialogueFooterEl.className = 'dialogue-footer';
      
      this.container.appendChild(this.nameEl);
      this.container.appendChild(this.textEl);
      this.container.appendChild(this.indicatorEl);
      this.container.appendChild(this.dialogueFooterEl);
      
      // Append right after game container
      const gameContainer = document.getElementById('game-container');
      gameContainer.appendChild(this.container);
      gameContainer.appendChild(this.choicesPanelEl);
    } else {
      this.nameEl = this.container.querySelector('.dialogue-name');
      this.textEl = this.container.querySelector('.dialogue-text');
      this.choicesPanelEl = document.querySelector('#game-container .dialogue-choices-panel');
      this.choicesEl = this.choicesPanelEl?.querySelector('.dialogue-choices') || document.createElement('div');
      this.indicatorEl = this.container.querySelector('.dialogue-indicator');
      
      this.dialogueFooterEl = this.container.querySelector('.dialogue-footer') || document.createElement('div');
      this.dialogueFooterEl.className = 'dialogue-footer';
      if (!this.dialogueFooterEl.parentNode) {
        this.container.appendChild(this.dialogueFooterEl);
      }

      if (!this.choicesPanelEl) {
        this.choicesPanelEl = document.createElement('div');
        this.choicesPanelEl.className = 'dialogue-choices-panel hidden';
        this.choicesEl = document.createElement('div');
        this.choicesEl.className = 'dialogue-choices';
        this.choicesPanelEl.appendChild(this.choicesEl);
        document.getElementById('game-container').appendChild(this.choicesPanelEl);
      }
    }

    // Input listener to advance dialogue
    this.scene.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.scene.input.keyboard.on('keydown-E', () => this.advance());
    // Also click
    this.container.addEventListener('click', (e) => {
      // Don't advance if clicking a choice or a footer badge
      if (e.target.classList.contains('dialogue-choice') || e.target.classList.contains('key-badge')) return;
      this.advance();
    });
  }

  _updateFooterText() {
    if (!this.dialogueFooterEl) return;
    this.dialogueFooterEl.innerHTML = '';
    
    if (this.choicesEl.children.length === 0) {
      // Normal dialogue mode
      const nextBtn = document.createElement('button');
      nextBtn.className = 'key-badge';
      nextBtn.innerHTML = 'ESPACIO / E ➔ Siguiente';
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        this.advance();
      };
      this.dialogueFooterEl.appendChild(nextBtn);
    } else {
      // Choice selection mode
      const upBtn = document.createElement('button');
      upBtn.className = 'key-badge';
      upBtn.innerHTML = '▲ W / ↑';
      upBtn.onclick = (e) => {
        e.stopPropagation();
        this._moveSelection(-1);
      };
      
      const downBtn = document.createElement('button');
      downBtn.className = 'key-badge';
      downBtn.innerHTML = '▼ S / ↓';
      downBtn.onclick = (e) => {
        e.stopPropagation();
        this._moveSelection(1);
      };
      
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'key-badge';
      confirmBtn.innerHTML = 'ESPACIO / ENTER (Confirmar)';
      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        this._activateSelectedChoice();
      };

      this.dialogueFooterEl.appendChild(upBtn);
      this.dialogueFooterEl.appendChild(downBtn);
      this.dialogueFooterEl.appendChild(confirmBtn);

      // Show details button if highlighted choice has qCallback
      const choice = this.choices ? this.choices[this.selectedChoiceIndex] : null;
      if (choice && choice.qCallback) {
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'key-badge details-badge';
        detailsBtn.innerHTML = 'Q (Detalles)';
        detailsBtn.onclick = (e) => {
          e.stopPropagation();
          this._handleQKeyPress();
        };
        this.dialogueFooterEl.appendChild(detailsBtn);
      }
    }
  }

  show(npcName, lines, onComplete = null) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lines = lines;
    this.currentLineIndex = 0;
    this.onComplete = onComplete;
    this.choices = [];
    
    this.nameEl.textContent = npcName;
    this.choicesEl.innerHTML = '';
    this.choicesPanelEl.classList.add('hidden');
    
    this.scene.game.events.emit('dialogue-open');
    this.container.classList.remove('hidden');
    
    this._typeLine();
  }

  showChoices(npcName, prompt, choices) {
    // Force-close any stale dialogue state so choices can always open.
    if (this.isActive) {
      this.hide();
    }
    
    this.isActive = true;
    this.lines = [prompt];
    this.currentLineIndex = 0;
    this.onComplete = null;
    
    this.nameEl.textContent = npcName;
    this.choicesEl.innerHTML = '';
    this.choicesPanelEl.classList.add('hidden');
    this.choiceButtons = [];
    this.selectedChoiceIndex = 0;
    this.choices = choices;
    
    this.scene.game.events.emit('dialogue-open');
    this.container.classList.remove('hidden');
    
    // Type the prompt, then show choices
    this._typeLine(() => {
      choices.forEach((choice, i) => {
        const btn = document.createElement('div');
        btn.className = 'dialogue-choice';
        btn.textContent = `${i + 1}. ${choice.text}`;
        btn.onmouseenter = () => {
          if (this.selectedChoiceIndex !== i) {
            this._setSelectedChoice(i);
            this._playUiBeep('move');
          }
        };
        
        // Handle click
        btn.onclick = () => {
          this._playUiBeep('confirm');
          this.hide();
          if (choice.callback) choice.callback();
        };
        
        this.choicesEl.appendChild(btn);
        this.choiceButtons.push(btn);
      });

      this.choicesPanelEl.classList.remove('hidden');
      this._setSelectedChoice(0);

      // Directional navigation + confirm (Undertale-like)
      const keyUp = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      const keyDown = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      const keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      const keyS = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      const keyEnter = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      const keySpace = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      const keyQ = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

      this.choiceKeys = [];
      this._bindChoiceKey = (key, event, cb) => {
        key.on(event, cb);
        this.choiceKeys.push({ key, event, callback: cb });
      };

      this._bindChoiceKey(keyUp, 'down', () => this._moveSelection(-1));
      this._bindChoiceKey(keyW, 'down', () => this._moveSelection(-1));
      this._bindChoiceKey(keyDown, 'down', () => this._moveSelection(1));
      this._bindChoiceKey(keyS, 'down', () => this._moveSelection(1));
      this._bindChoiceKey(keyEnter, 'down', () => this._activateSelectedChoice());
      this._bindChoiceKey(keySpace, 'down', () => this._activateSelectedChoice());
      this._bindChoiceKey(keyQ, 'down', () => this._handleQKeyPress());
      
      // Also bind numeric keyboard keys 1..9
      choices.forEach((choice, i) => {
        const keyCodes = [
          Phaser.Input.Keyboard.KeyCodes.ONE,
          Phaser.Input.Keyboard.KeyCodes.TWO,
          Phaser.Input.Keyboard.KeyCodes.THREE,
          Phaser.Input.Keyboard.KeyCodes.FOUR,
          Phaser.Input.Keyboard.KeyCodes.FIVE,
          Phaser.Input.Keyboard.KeyCodes.SIX,
          Phaser.Input.Keyboard.KeyCodes.SEVEN,
          Phaser.Input.Keyboard.KeyCodes.EIGHT,
          Phaser.Input.Keyboard.KeyCodes.NINE,
        ];
        const code = keyCodes[i];
        if (!code) return;

        const key = this.scene.input.keyboard.addKey(code);
        const cb = () => {
          if (!this.isActive) return;
          this._playUiBeep('confirm');
          this.hide();
          if (choice.callback) choice.callback();
        };
        this._bindChoiceKey(key, 'down', cb);
      });
    });
  }

  hide() {
    this.isActive = false;
    this.container.classList.add('hidden');
    this.choicesPanelEl.classList.add('hidden');
    this.indicatorEl.classList.remove('visible');
    this.choiceButtons = [];
    this.selectedChoiceIndex = 0;
    this.choices = [];
    
    if (this.typeTimer) clearInterval(this.typeTimer);
    
    // Cleanup choice keys
    if (this.choiceKeys) {
      this.choiceKeys.forEach(({ key, event, callback }) => {
        key.off(event, callback);
      });
      this.choiceKeys = null;
    }
    
    this.scene.game.events.emit('dialogue-close');
  }

  advance() {
    if (!this.isActive) return;
    // Don't advance if we are showing choices
    if (this.choicesEl.children.length > 0) return;
    if (this._choiceJustConfirmed) {
      this._choiceJustConfirmed = false;
      return;
    }

    // Dopamine-chasing check: skip dialogues too fast
    const now = this.scene.time.now;
    const elapsed = now - this.lastLineStartTime;
    
    if (elapsed < 400) {
      this.fastSkipCount = (this.fastSkipCount || 0) + 1;
    } else {
      this.fastSkipCount = Math.max(0, (this.fastSkipCount || 0) - 1);
    }

    if (this.fastSkipCount >= 3) {
      this.fastSkipCount = 0;
      this.triggerReprimand();
      return;
    }

    if (this.isTyping) {
      // Skip typing, show full line immediately
      clearInterval(this.typeTimer);
      this.textEl.textContent = this.lines[this.currentLineIndex];
      this.isTyping = false;
      this.indicatorEl.classList.add('visible');

      // If this line had a completion callback (e.g. to render choices), run it.
      if (this._lineCompleteCallback) {
        const cb = this._lineCompleteCallback;
        this._lineCompleteCallback = null;
        cb();
      }
    } else {
      // Next line
      this.currentLineIndex++;
      if (this.currentLineIndex < this.lines.length) {
        this._typeLine();
      } else {
        // Dialogue over
        this.hide();
        if (this.onComplete) this.onComplete();
      }
    }
  }

  triggerReprimand() {
    if (this.typeTimer) clearInterval(this.typeTimer);

    // Subtract player moral/reputation
    if (this.scene.player) {
      this.scene.player.addMoral(-5);
      const uiScene = this.scene.scene.get('UI');
      if (uiScene?.showNotification) {
        uiScene.showNotification('⚫ Moralidad reducida (-5) por impaciencia', '#ff4444');
      }
    }

    const currentNpc = this.nameEl.textContent;
    this.nameEl.textContent = `😡 ${currentNpc} (Enojado)`;
    this.choicesEl.innerHTML = '';

    const reprimands = [
      "¡Oye! ¡Presta atención cuando te hablo! No vengas aquí con prisas y sin respeto.",
      "¡Deja de saltarte mis palabras! Si no tienes la disciplina de leer, no mereces mi tiempo. ¡Vuelve a empezar!",
      "¡Suficiente! Veo que solo buscas descargas rápidas de dopamina. Vuelve a iniciar la conversación y lee con atención."
    ];
    const text = reprimands[Math.floor(Math.random() * reprimands.length)];

    this.lines = [text];
    this.currentLineIndex = 0;
    this.onComplete = null; // Clear callbacks so they don't get the quest/items
    this._typeLine();
  }

  _typeLine(onLineComplete = null) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this._lineCompleteCallback = onLineComplete;
    
    this.lastLineStartTime = this.scene.time.now;
    this.indicatorEl.classList.remove('visible');
    this.textEl.textContent = '';
    const line = this.lines[this.currentLineIndex];
    this.charIndex = 0;
    this.isTyping = true;
    
    this._updateFooterText();
    
    this.typeTimer = setInterval(() => {
      if (!this.isActive) {
        clearInterval(this.typeTimer);
        return;
      }
      this.textEl.textContent += line[this.charIndex];
      this.charIndex++;
      
      if (this.charIndex >= line.length) {
        clearInterval(this.typeTimer);
        this.isTyping = false;
        this.indicatorEl.classList.add('visible');
        if (this._lineCompleteCallback) {
          const cb = this._lineCompleteCallback;
          this._lineCompleteCallback = null;
          cb();
        }
      }
    }, 30); // 30ms per char
  }

  _setSelectedChoice(index) {
    if (!this.choiceButtons || this.choiceButtons.length === 0) return;

    const max = this.choiceButtons.length - 1;
    this.selectedChoiceIndex = Phaser.Math.Clamp(index, 0, max);

    this.choiceButtons.forEach((btn, i) => {
      if (i === this.selectedChoiceIndex) btn.classList.add('selected');
      else btn.classList.remove('selected');
    });

    this._updateFooterText();
  }

  _moveSelection(delta) {
    if (!this.isActive || !this.choiceButtons || this.choiceButtons.length === 0) return;
    const len = this.choiceButtons.length;
    const next = (this.selectedChoiceIndex + delta + len) % len;
    this._playUiBeep('move');
    this._setSelectedChoice(next);
  }

  _handleQKeyPress() {
    if (!this.isActive || !this.choiceButtons || this.choiceButtons.length === 0) return;
    const choice = this.choices[this.selectedChoiceIndex];
    if (choice && choice.qCallback) {
      this._playUiBeep('confirm');
      this.hide();
      choice.qCallback();
    }
  }

  _activateSelectedChoice() {
    if (!this.isActive || !this.choiceButtons || this.choiceButtons.length === 0) return;
    this._playUiBeep('confirm');
    const btn = this.choiceButtons[this.selectedChoiceIndex];
    if (btn && typeof btn.click === 'function') {
      this._choiceJustConfirmed = true;
      this.scene.time.delayedCall(50, () => {
        this._choiceJustConfirmed = false;
      });
      btn.click();
    }
  }

  _playUiBeep(kind = 'move') {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      if (!this._audioCtx) {
        this._audioCtx = new Ctx();
      }
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }

      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      if (kind === 'confirm') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.02, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      // Ignore audio errors to keep dialogue functional on restricted browsers.
    }
  }
}


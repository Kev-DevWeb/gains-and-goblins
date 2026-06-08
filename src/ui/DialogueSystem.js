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
    this._lineCompleteCallback = null;
    this._audioCtx = null;

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
      
      this.container.appendChild(this.nameEl);
      this.container.appendChild(this.textEl);
      this.container.appendChild(this.indicatorEl);
      
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
      // Don't advance if clicking a choice
      if (e.target.classList.contains('dialogue-choice')) return;
      this.advance();
    });
  }

  show(npcName, lines, onComplete = null) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lines = lines;
    this.currentLineIndex = 0;
    this.onComplete = onComplete;
    
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

      keyUp.on('down', () => this._moveSelection(-1));
      keyW.on('down', () => this._moveSelection(-1));
      keyDown.on('down', () => this._moveSelection(1));
      keyS.on('down', () => this._moveSelection(1));
      keyEnter.on('down', () => this._activateSelectedChoice());
      
      // Also bind numeric keyboard keys 1..9
      this.choiceKeys = [keyUp, keyDown, keyW, keyS, keyEnter];
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
        key.on('down', () => {
          if (!this.isActive) return;
          this._playUiBeep('confirm');
          this.hide();
          if (choice.callback) choice.callback();
        });
        this.choiceKeys.push(key);
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
    
    if (this.typeTimer) clearInterval(this.typeTimer);
    
    // Cleanup choice keys
    if (this.choiceKeys) {
      this.choiceKeys.forEach(k => k.destroy());
      this.choiceKeys = null;
    }
    
    this.scene.game.events.emit('dialogue-close');
  }

  advance() {
    if (!this.isActive) return;
    // Don't advance if we are showing choices
    if (this.choicesEl.children.length > 0) return;

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
  }

  _moveSelection(delta) {
    if (!this.isActive || !this.choiceButtons || this.choiceButtons.length === 0) return;
    const len = this.choiceButtons.length;
    const next = (this.selectedChoiceIndex + delta + len) % len;
    this._playUiBeep('move');
    this._setSelectedChoice(next);
  }

  _activateSelectedChoice() {
    if (!this.isActive || !this.choiceButtons || this.choiceButtons.length === 0) return;
    this._playUiBeep('confirm');
    const btn = this.choiceButtons[this.selectedChoiceIndex];
    if (btn && typeof btn.click === 'function') btn.click();
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

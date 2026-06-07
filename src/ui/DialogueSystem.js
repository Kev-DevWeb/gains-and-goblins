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

    this._createUI();
  }

  _createUI() {
    const boxWidth = GAME_WIDTH - 40;
    const boxHeight = 120;
    const boxX = 20;
    const boxY = GAME_HEIGHT - 130;

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
      
      this.choicesEl = document.createElement('div');
      this.choicesEl.className = 'dialogue-choices';
      
      this.indicatorEl = document.createElement('div');
      this.indicatorEl.className = 'dialogue-indicator';
      
      this.container.appendChild(this.nameEl);
      this.container.appendChild(this.textEl);
      this.container.appendChild(this.choicesEl);
      this.container.appendChild(this.indicatorEl);
      
      // Append right after game container
      document.getElementById('game-container').appendChild(this.container);
    } else {
      this.nameEl = this.container.querySelector('.dialogue-name');
      this.textEl = this.container.querySelector('.dialogue-text');
      this.choicesEl = this.container.querySelector('.dialogue-choices');
      this.indicatorEl = this.container.querySelector('.dialogue-indicator');
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
    
    this.scene.game.events.emit('dialogue-open');
    this.container.classList.remove('hidden');
    
    this._typeLine();
  }

  showChoices(npcName, prompt, choices) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lines = [prompt];
    this.currentLineIndex = 0;
    this.onComplete = null;
    
    this.nameEl.textContent = npcName;
    this.choicesEl.innerHTML = '';
    
    this.scene.game.events.emit('dialogue-open');
    this.container.classList.remove('hidden');
    
    // Type the prompt, then show choices
    this._typeLine(() => {
      choices.forEach((choice, i) => {
        const btn = document.createElement('div');
        btn.className = 'dialogue-choice';
        btn.textContent = `${i + 1}. ${choice.text}`;
        
        // Handle click
        btn.onclick = () => {
          this.hide();
          if (choice.callback) choice.callback();
        };
        
        this.choicesEl.appendChild(btn);
      });
      
      // Also bind keyboard 1, 2, 3
      this.choiceKeys = [];
      choices.forEach((choice, i) => {
        const num = i + 1;
        const key = this.scene.input.keyboard.addKey(num.toString());
        key.once('down', () => {
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
    this.indicatorEl.classList.remove('visible');
    
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
        if (onLineComplete) onLineComplete();
      }
    }, 30); // 30ms per char
  }
}

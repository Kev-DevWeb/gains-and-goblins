import SaveSystem from '../utils/SaveSystem.js';

export default class ShopSystem {
  constructor(game, dialogueSystem) {
    this.game = game;
    this.dialogue = dialogueSystem;
  }

  openShop(player) {
    const choices = [
      {
        text: 'Agua Mineral (25 Oro) - Restaura 30 HP',
        callback: () => this._buyHealthPotion(player)
      },
      {
        text: 'Café Cargado (25 Oro) - Restaura 20 Maná',
        callback: () => this._buyManaPotion(player)
      },
      {
        text: 'No, gracias. (Salir)',
        callback: () => {
          this.dialogue.show('Recepcionista', ['Vuelve cuando necesites hidratarte.']);
        }
      }
    ];

    this.dialogue.showChoices('Recepcionista', '¿Qué te gustaría comprar hoy?', choices);
  }

  async _buyHealthPotion(player) {
    if (player.gold >= 25) {
      const updatedCharacter = await SaveSystem.buyItem('potion_hp', 25, 'Agua Mineral', '🥤', 'consumable');
      if (updatedCharacter) {
        player.gold = updatedCharacter.gold;
        player.inventory = updatedCharacter.inventory;
        
        this.game.events.emit('update-gold', player.gold);
        this.game.events.emit('update-inventory', player.inventory);
        this.game.events.emit('show-notification', 'Compraste Agua Mineral', '#3ac55e');
        
        this.dialogue.show('Recepcionista', ['¡Aquí tienes tu Agua Mineral bien fría!', '¿Algo más?'], () => {
          // Re-open shop
          setTimeout(() => this.openShop(player), 100);
        });
      } else {
        this.game.events.emit('show-notification', 'Error de red en compra', '#e94560');
      }
    } else {
      this.dialogue.show('Recepcionista', ['No tienes suficiente oro para comprar Agua Mineral.']);
    }
  }

  async _buyManaPotion(player) {
    if (player.gold >= 25) {
      const updatedCharacter = await SaveSystem.buyItem('potion_mp', 25, 'Café Cargado', '☕', 'consumable');
      if (updatedCharacter) {
        player.gold = updatedCharacter.gold;
        player.inventory = updatedCharacter.inventory;
        
        this.game.events.emit('update-gold', player.gold);
        this.game.events.emit('update-inventory', player.inventory);
        this.game.events.emit('show-notification', 'Compraste Café Cargado', '#4488ff');
        
        this.dialogue.show('Recepcionista', ['¡Aquí tienes tu Café bien cargado!', '¿Algo más?'], () => {
          // Re-open shop
          setTimeout(() => this.openShop(player), 100);
        });
      } else {
        this.game.events.emit('show-notification', 'Error de red en compra', '#e94560');
      }
    } else {
      this.dialogue.show('Recepcionista', ['No tienes suficiente oro para comprar Café.']);
    }
  }
}

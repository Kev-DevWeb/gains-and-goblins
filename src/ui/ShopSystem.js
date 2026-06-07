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

  _buyHealthPotion(player) {
    if (player.gold >= 25) {
      player.gold -= 25;
      player.addItem({ id: 'potion_hp', name: 'Agua Mineral', count: 1, icon: '🥤' });
      
      this.game.events.emit('update-gold', player.gold);
      this.game.events.emit('show-notification', 'Compraste Agua Mineral', '#3ac55e');
      
      this.dialogue.show('Recepcionista', ['¡Aquí tienes tu Agua Mineral bien fría!', '¿Algo más?'], () => {
        // Re-open shop
        setTimeout(() => this.openShop(player), 100);
      });
    } else {
      this.dialogue.show('Recepcionista', ['No tienes suficiente oro para comprar Agua Mineral.']);
    }
  }

  _buyManaPotion(player) {
    if (player.gold >= 25) {
      player.gold -= 25;
      player.addItem({ id: 'potion_mp', name: 'Café Cargado', count: 1, icon: '☕' });
      
      this.game.events.emit('update-gold', player.gold);
      this.game.events.emit('show-notification', 'Compraste Café Cargado', '#4488ff');
      
      this.dialogue.show('Recepcionista', ['¡Aquí tienes tu Café bien cargado!', '¿Algo más?'], () => {
        // Re-open shop
        setTimeout(() => this.openShop(player), 100);
      });
    } else {
      this.dialogue.show('Recepcionista', ['No tienes suficiente oro para comprar Café.']);
    }
  }
}

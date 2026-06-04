export default class ShopSystem {
  constructor(game, dialogueSystem) {
    this.game = game;
    this.dialogue = dialogueSystem;
  }

  openShop(player) {
    const choices = [
      {
        text: 'Poción de Vida (20 Oro) - Restaura 30 HP',
        callback: () => this._buyHealthPotion(player)
      },
      {
        text: 'Poción de Maná (15 Oro) - Restaura 20 Maná',
        callback: () => this._buyManaPotion(player)
      },
      {
        text: 'No, gracias. (Salir)',
        callback: () => {
          this.dialogue.show('Alquimista', ['Vuelve cuando necesites algo.']);
        }
      }
    ];

    this.dialogue.showChoices('Alquimista', '¿Qué te gustaría comprar?', choices);
  }

  _buyHealthPotion(player) {
    if (player.gold >= 20) {
      player.gold -= 20;
      player.addItem({ id: 'potion_hp', name: 'Poción de Vida', count: 1, icon: '🧪' });
      
      this.game.events.emit('update-gold', player.gold);
      this.game.events.emit('show-notification', 'Compraste Poción de Vida', '#3ac55e');
      
      this.dialogue.show('Alquimista', ['¡Excelente elección!', '¿Algo más?'], () => {
        // Re-open shop
        setTimeout(() => this.openShop(player), 100);
      });
    } else {
      this.dialogue.show('Alquimista', ['No tienes suficiente oro para eso.']);
    }
  }

  _buyManaPotion(player) {
    if (player.gold >= 15) {
      player.gold -= 15;
      player.addItem({ id: 'potion_mp', name: 'Poción de Maná', count: 1, icon: '💧' });
      
      this.game.events.emit('update-gold', player.gold);
      this.game.events.emit('show-notification', 'Compraste Poción de Maná', '#4488ff');
      
      this.dialogue.show('Alquimista', ['¡Excelente elección!', '¿Algo más?'], () => {
        // Re-open shop
        setTimeout(() => this.openShop(player), 100);
      });
    } else {
      this.dialogue.show('Alquimista', ['No tienes suficiente oro para eso.']);
    }
  }
}

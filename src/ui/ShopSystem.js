import SaveSystem from '../utils/SaveSystem.js';

const SHOP_ITEMS = [
  {
    id: 'potion_hp',
    name: 'Agua Mineral',
    shortName: 'Agua Mineral',
    icon: '🥤',
    price: 25,
    effect: 'Restaura 30 HP',
    color: '#3ac55e',
    thanks: '¡Aquí tienes tu Agua Mineral bien fría!'
  },
  {
    id: 'potion_mp',
    name: 'Café Cargado',
    shortName: 'Café',
    icon: '☕',
    price: 25,
    effect: 'Restaura 20 Maná',
    color: '#4488ff',
    thanks: '¡Aquí tienes tu Café bien cargado!'
  }
];

export default class ShopSystem {
  constructor(game, dialogueSystem) {
    this.game = game;
    this.dialogue = dialogueSystem;
  }

  openShop(player) {
    const choices = SHOP_ITEMS.map(item => ({
      text: `${item.name} (${item.price} Oro) - ${item.effect}`,
      callback: () => this._buyItem(player, item)
    }));
    choices.push({
      text: 'No, gracias. (Salir)',
      callback: () => {
        this.dialogue.show('Recepcionista', ['Vuelve cuando necesites hidratarte.']);
      }
    });

    this.dialogue.showChoices('Recepcionista', '¿Qué te gustaría comprar hoy?', choices);
  }

  async _buyItem(player, item) {
    if (player.gold < item.price) {
      this.dialogue.show('Recepcionista', [`No tienes suficiente oro para comprar ${item.shortName}.`]);
      return;
    }

    const updatedCharacter = await SaveSystem.buyItem(item.id);
    if (!updatedCharacter) {
      this.game.events.emit('show-notification', 'Error de red en compra', '#e94560');
      return;
    }

    player.gold = updatedCharacter.gold;
    player.inventory = updatedCharacter.inventory;

    this.game.events.emit('update-gold', player.gold);
    this.game.events.emit('update-inventory', player.inventory);
    this.game.events.emit('show-notification', `Compraste ${item.name}`, item.color);

    this.dialogue.show('Recepcionista', [item.thanks, '¿Algo más?'], () => {
      setTimeout(() => this.openShop(player), 100);
    });
  }
}

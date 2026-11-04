import Phaser from 'phaser';
import { supabase } from './supabaseClient.js';

const INVITE_TTL_MS = 60000;

/**
 * Online presence and party invites over Supabase Realtime (no game server).
 * Every signed-in player joins one "lobby" channel and announces their hero name
 * and PeerJS id; invites are broadcasts addressed to a player id. The game itself
 * still runs peer to peer through P2PManager.
 *
 * Emits the same events the old Socket.IO server did:
 * invite-received, invite-sent, invite-error, invite-declined, invite-accepted.
 */
export default class Lobby extends Phaser.Events.EventEmitter {
  constructor(userId, characterName) {
    super();
    this.userId = userId;
    this.characterName = characterName;
    this.peerJsId = null;
    this._sentInvites = new Map();     // inviteId -> { toUserId, toEmail }
    this._receivedInvites = new Map(); // inviteId -> { fromUserId, fromCharacterName }

    this.channel = supabase.channel('lobby', {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    this.channel.on('broadcast', { event: 'invite' }, ({ payload }) => this._onInvite(payload));
    this.channel.on('broadcast', { event: 'invite-response' }, ({ payload }) => this._onInviteResponse(payload));
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') this._announce();
    });
  }

  setPeerId(peerJsId) {
    this.peerJsId = peerJsId;
    this._announce();
  }

  _announce() {
    if (this.channel.state !== 'joined') return;
    this.channel.track({ characterName: this.characterName, peerJsId: this.peerJsId });
  }

  _presenceOf(userId) {
    return this.channel.presenceState()[userId]?.[0] || null;
  }

  async sendInvite(email) {
    const toEmail = (email || '').toLowerCase().trim();
    if (!toEmail) return this.emit('invite-error', 'Correo de destino requerido.');

    const { data: toUserId, error } = await supabase.rpc('find_player_by_email', { p_email: toEmail });
    if (error) return this.emit('invite-error', 'No se pudo enviar la invitacion.');
    if (!toUserId || !this._presenceOf(toUserId)) return this.emit('invite-error', `${toEmail} no esta en linea.`);

    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._sentInvites.set(inviteId, { toUserId, toEmail });
    setTimeout(() => this._sentInvites.delete(inviteId), INVITE_TTL_MS);

    this.channel.send({
      type: 'broadcast',
      event: 'invite',
      payload: { inviteId, toUserId, fromUserId: this.userId, fromCharacterName: this.characterName },
    });
    this.emit('invite-sent', { toEmail, inviteId });
  }

  _onInvite({ inviteId, toUserId, fromUserId, fromCharacterName }) {
    if (toUserId !== this.userId) return;
    this._receivedInvites.set(inviteId, { fromUserId, fromCharacterName });
    setTimeout(() => this._receivedInvites.delete(inviteId), INVITE_TTL_MS);
    this.emit('invite-received', { inviteId, fromCharacterName });
  }

  respond(inviteId, accepted) {
    const invite = this._receivedInvites.get(inviteId);
    if (!invite) return this.emit('invite-error', 'La invitacion ya expiro o no existe.');
    this._receivedInvites.delete(inviteId);

    const host = this._presenceOf(invite.fromUserId);
    if (accepted && !host?.peerJsId) return this.emit('invite-error', 'El host ya no esta disponible.');

    this.channel.send({
      type: 'broadcast',
      event: 'invite-response',
      payload: { inviteId, toUserId: invite.fromUserId, accepted, guestCharacterName: this.characterName },
    });
    if (accepted) {
      this.emit('invite-accepted', {
        inviteId,
        role: 'guest',
        hostPeerId: host.peerJsId,
        hostCharacterName: invite.fromCharacterName,
      });
    }
  }

  _onInviteResponse({ inviteId, toUserId, accepted, guestCharacterName }) {
    if (toUserId !== this.userId) return;
    const invite = this._sentInvites.get(inviteId);
    if (!invite) return;
    this._sentInvites.delete(inviteId);

    if (!accepted) {
      this.emit('invite-declined', { inviteId, guestEmail: invite.toEmail });
      return;
    }
    this.emit('invite-accepted', { inviteId, role: 'host', guestCharacterName });
  }

  destroy() {
    this.removeAllListeners();
    supabase.removeChannel(this.channel);
  }
}

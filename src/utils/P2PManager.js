/**
 * P2PManager.js
 * Gestiona conexiones WebRTC usando PeerJS (hasta 4 jugadores: 1 host + 3 guests).
 * El servidor de Railway solo se usa para enviar invitaciones por correo.
 * PeerJS maneja automáticamente el ICE/STUN/signaling a través de su servidor cloud.
 *
 * Topología: Estrella centrada en el HOST.
 *   Host (P1) ←→ Guest P2
 *   Host (P1) ←→ Guest P3
 *   Host (P1) ←→ Guest P4
 *
 * Los guests envían su estado al host, el host hace broadcast a todos los demás.
 */

import Peer from 'peerjs';

// Colores distintos para cada slot de jugador
export const PLAYER_COLORS = {
  P1: null,         // Sin tint — color original
  P2: 0x88aaff,    // Azul
  P3: 0x88ffaa,    // Verde menta
  P4: 0xffcc88,    // Naranja dorado
};

export const MAX_PLAYERS = 4;

export default class P2PManager {
  constructor() {
    this.peer = null;        // La instancia PeerJS local
    this.peerId = null;      // Nuestro ID de peer (generado por PeerJS)

    // Conexiones activas: Map<peerId, { conn, playerSlot, characterName }>
    this.connections = new Map();

    this.isHost = false;
    this.hostPeerId = null;  // Para guests: el peerId del host

    // Callbacks
    this._onPlayerJoined = null;   // (peerId, characterName, slot, x, y) => void
    this._onPlayerLeft = null;     // (peerId, slot) => void
    this._onDataReceived = null;   // (peerId, data) => void
    this._onReady = null;          // (myPeerId) => void
  }

  // ── INIT ──────────────────────────────────────────────────────────

  /**
   * Inicializa el peer local. Llama onReady(peerId) cuando esté listo.
   * Debe llamarse al inicio, independientemente del rol (host o guest).
   */
  init() {
    return new Promise((resolve, reject) => {
      // Usar PeerJS cloud server (gratis, no requiere configuración)
      this.peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        },
        debug: 0
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        console.log('[P2P] Peer listo, ID:', id);
        if (this._onReady) this._onReady(id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('[P2P] PeerJS error:', err);
        reject(err);
      });

      // HOST: escucha conexiones entrantes de nuevos guests
      this.peer.on('connection', (conn) => {
        if (!this.isHost) return;
        this._handleIncomingConnection(conn);
      });
    });
  }

  // ── HOST ───────────────────────────────────────────────────────────

  /**
   * Activa el modo host. A partir de aquí acepta conexiones de guests.
   */
  becomeHost() {
    this.isHost = true;
    this.hostPeerId = this.peerId;
    console.log('[P2P] Modo HOST activado. PeerId:', this.peerId);
  }

  /**
   * Maneja una nueva conexión entrante de un guest.
   */
  _handleIncomingConnection(conn) {
    if (this.connections.size >= MAX_PLAYERS - 1) {
      // Sala llena, rechazar
      conn.on('open', () => {
        conn.send(JSON.stringify({ type: 'room-full' }));
        conn.close();
      });
      return;
    }

    conn.on('open', () => {
      // Asignar slot disponible (P2, P3 o P4)
      const slot = this._nextAvailableSlot();
      const peerId = conn.peer;

      this.connections.set(peerId, { conn, slot, characterName: 'Jugador' });

      console.log(`[P2P] Guest conectado: ${peerId} → ${slot}`);

      // Enviar bienvenida al guest (su slot + lista de otros jugadores)
      const others = [];
      this.connections.forEach((data, pid) => {
        if (pid !== peerId) {
          others.push({ peerId: pid, slot: data.slot, characterName: data.characterName });
        }
      });

      conn.send(JSON.stringify({
        type: 'welcome',
        yourSlot: slot,
        players: others
      }));

      // Notificar a los otros guests sobre el recién llegado
      this._broadcastExcept(peerId, {
        type: 'player-joined',
        peerId,
        slot,
        characterName: 'Jugador', // se actualiza cuando recibamos su primer update
      });

      // Emitir evento local para que WorldScene agregue el sprite del guest
      if (this._onPlayerJoined) this._onPlayerJoined(peerId, 'Jugador', slot, 0, 0);
    });

    conn.on('data', (rawData) => {
      try {
        const data = JSON.parse(rawData);
        const connData = this.connections.get(conn.peer);

        // Actualizar nombre del personaje si nos lo mandan
        if (data.characterName && connData) {
          connData.characterName = data.characterName;
        }

        // Host recibe datos del guest → callback local + rebroadcast a otros
        if (this._onDataReceived) this._onDataReceived(conn.peer, data);

        // Relay a los demás (agregar peerId fuente para que los otros sepan quién movió)
        this._broadcastExcept(conn.peer, { ...data, _fromPeerId: conn.peer });
      } catch (e) {
        console.warn('[P2P] Host: error parseando datos de guest:', e);
      }
    });

    conn.on('close', () => {
      const connData = this.connections.get(conn.peer);
      const slot = connData?.slot;
      this.connections.delete(conn.peer);
      console.log(`[P2P] Guest desconectado: ${conn.peer} (${slot})`);
      if (this._onPlayerLeft) this._onPlayerLeft(conn.peer, slot);
      // Notificar a otros guests
      this._broadcastAll({ type: 'player-left', peerId: conn.peer, slot });
    });

    conn.on('error', (err) => console.warn('[P2P] Conn error:', err));
  }

  // ── GUEST ──────────────────────────────────────────────────────────

  /**
   * Guest se conecta al host por su peerId.
   * @param {string} targetHostPeerId
   */
  connectToHost(targetHostPeerId) {
    this.isHost = false;
    this.hostPeerId = targetHostPeerId;

    const conn = this.peer.connect(targetHostPeerId, {
      reliable: false,  // UDP-like, no esperar paquetes perdidos
      serialization: 'raw'
    });

    this.connections.set(targetHostPeerId, { conn, slot: 'P1', characterName: 'Host' });

    conn.on('open', () => {
      console.log('[P2P] Guest: conectado al host', targetHostPeerId);
    });

    conn.on('data', (rawData) => {
      try {
        const data = JSON.parse(rawData);

        // Mensaje de bienvenida del host
        if (data.type === 'welcome') {
          // Actualizar slot propio
          const hostConn = this.connections.get(targetHostPeerId);
          if (hostConn) hostConn.slot = 'P1'; // host siempre P1

          // Notificar al WorldScene sobre jugadores ya presentes
          data.players.forEach(p => {
            if (this._onPlayerJoined) this._onPlayerJoined(p.peerId, p.characterName, p.slot, 0, 0);
          });

          // Disparar evento ready con nuestro slot asignado
          if (this._onReady) this._onReady(this.peerId);
          return;
        }

        if (data.type === 'room-full') {
          console.warn('[P2P] Sala llena, no se pudo unir.');
          if (this._onPlayerLeft) this._onPlayerLeft(null, null); // signal error
          return;
        }

        if (data.type === 'player-joined') {
          if (this._onPlayerJoined) this._onPlayerJoined(data.peerId, data.characterName, data.slot, 0, 0);
          return;
        }

        if (data.type === 'player-left') {
          if (this._onPlayerLeft) this._onPlayerLeft(data.peerId, data.slot);
          return;
        }

        // Datos de estado de otro jugador (relayed por el host)
        if (this._onDataReceived) this._onDataReceived(data._fromPeerId || targetHostPeerId, data);
      } catch (e) {
        console.warn('[P2P] Guest: error parseando datos del host:', e);
      }
    });

    conn.on('close', () => {
      console.log('[P2P] Conexión con host cerrada');
      this.connections.delete(targetHostPeerId);
      if (this._onPlayerLeft) this._onPlayerLeft(targetHostPeerId, 'P1');
    });

    conn.on('error', (err) => console.warn('[P2P] Guest conn error:', err));
  }

  // ── ENVÍO DE DATOS ─────────────────────────────────────────────────

  /**
   * Envía datos al host (si somos guest) o hace broadcast a todos los guests (si somos host).
   */
  sendData(data) {
    const raw = JSON.stringify(data);
    if (this.isHost) {
      this._broadcastAll(data);
    } else {
      // Guest: enviar solo al host
      const hostConn = this.connections.get(this.hostPeerId);
      if (hostConn?.conn?.open) {
        try { hostConn.conn.send(raw); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Broadcast a todos los conectados menos el excluido.
   */
  _broadcastExcept(excludePeerId, data) {
    const raw = JSON.stringify(data);
    this.connections.forEach((connData, peerId) => {
      if (peerId !== excludePeerId && connData.conn?.open) {
        try { connData.conn.send(raw); } catch (e) { /* ignore */ }
      }
    });
  }

  /**
   * Broadcast a TODOS los conectados.
   */
  _broadcastAll(data) {
    const raw = JSON.stringify(data);
    this.connections.forEach((connData) => {
      if (connData.conn?.open) {
        try { connData.conn.send(raw); } catch (e) { /* ignore */ }
      }
    });
  }

  // ── CALLBACKS ──────────────────────────────────────────────────────

  onPlayerJoined(cb) { this._onPlayerJoined = cb; }
  onPlayerLeft(cb)   { this._onPlayerLeft = cb; }
  onDataReceived(cb) { this._onDataReceived = cb; }
  onReady(cb)        { this._onReady = cb; }

  // ── HELPERS ────────────────────────────────────────────────────────

  /** Devuelve el primer slot disponible (P2, P3, P4). */
  _nextAvailableSlot() {
    const used = new Set();
    this.connections.forEach(c => used.add(c.slot));
    for (const slot of ['P2', 'P3', 'P4']) {
      if (!used.has(slot)) return slot;
    }
    return 'P4'; // fallback
  }

  /** Retorna el slot propio (los guests lo reciben del host vía 'welcome'). */
  get mySlot() {
    return this._mySlot || (this.isHost ? 'P1' : null);
  }

  set mySlot(s) { this._mySlot = s; }

  /** ¿Está el peer listo? */
  isReady() { return !!this.peer && !!this.peerId; }

  /** ¿Estamos conectados a algún peer? */
  isConnected() {
    return this.connections.size > 0;
  }

  /** ¿Hay espacio para más jugadores? (solo relevante en host) */
  hasRoom() { return this.connections.size < MAX_PLAYERS - 1; }

  /** Cierra todas las conexiones y destruye el peer. */
  close() {
    this.connections.forEach(({ conn }) => {
      try { conn.close(); } catch (e) { /* ignore */ }
    });
    this.connections.clear();
    if (this.peer && !this.peer.destroyed) {
      try { this.peer.destroy(); } catch (e) { /* ignore */ }
    }
    this.peer = null;
    this.peerId = null;
    this.isHost = false;
    this.hostPeerId = null;
    console.log('[P2P] Peer destruido.');
  }
}

import { AssimilacaoModule } from './assimilacao/sheet.js';
import { formatSymbolsHTML, getSymbolIcon } from './assimilacao/rules.js';

const RoomTransport = {
  roomId: 'mesa-01',
  listeners: [],
  connect(roomId) {
    this.roomId = roomId;
    document.getElementById('roomStatusText').textContent = `Sala "${roomId}" ativa (Modo Local)`;
  },
  onRoll(cb) { this.listeners.push(cb); },
  async sendRoll(payload) {
    const enriched = { ...payload, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
    this.listeners.forEach(fn => fn(enriched));
  }
};

const NexusCore = {
  async init() {
    await AssimilacaoModule.init();
    AssimilacaoModule.render(document.getElementById('systemViewport'), RoomTransport);

    RoomTransport.onRoll(msg => {
      const feed = document.getElementById('rollFeed');
      const li = document.createElement('li');
      li.className = 'feed-item';
      const diceHTML = msg.dice.map(d => `<span class="mini-die ${d.kept ? 'kept' : ''}">d${d.sides}: ${formatSymbolsHTML(d.symbols, true)}</span>`).join('');
      li.innerHTML = `
        <div class="feed-item-head"><strong>${msg.player}</strong><span class="muted">${msg.timestamp || ''}</span></div>
        <div class="muted">${msg.testLabel}</div>
        <div class="feed-dice-row">${diceHTML}</div>
        <div style="display:flex;gap:10px;margin-top:4px;">
          <span class="sym-badge sym-A">${msg.totals.A} ${getSymbolIcon('A', true)}</span>
          <span class="sym-badge sym-B">${msg.totals.B} ${getSymbolIcon('B', true)}</span>
          <span class="sym-badge sym-C">${msg.totals.C} ${getSymbolIcon('C', true)}</span>
        </div>
      `;
      feed.prepend(li);
    });

    document.getElementById('btnJoinRoom').onclick = () => RoomTransport.connect(document.getElementById('roomCode').value.trim() || 'mesa-01');
    document.getElementById('btnClearFeed').onclick = () => { document.getElementById('rollFeed').innerHTML = ''; };
  }
};

document.addEventListener('DOMContentLoaded', () => NexusCore.init());
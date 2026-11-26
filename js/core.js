import { AssimilacaoModule } from './assimilacao/sheet.js';
import { formatSymbolsHTML, getSymbolIcon } from './assimilacao/rules.js';

// Camada de transporte da sala. Hoje roda localmente em memória,
// mas a interface onRoll/sendRoll já está isolada para plugar WebSockets depois.
const roomSession = {
  roomId: 'mesa-01',
  listeners: [],

  connect(roomId) {
    this.roomId = roomId;
    const statusEl = document.getElementById('roomStatusText');
    if (statusEl) statusEl.textContent = `Sala "${roomId}" ativa (Modo Local)`;
  },

  onRoll(callback) {
    this.listeners.push(callback);
  },

  async sendRoll(payload) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const entry = { ...payload, timestamp };
    this.listeners.forEach(listener => listener(entry));
  }
};

function renderFeedEntry(message) {
  const feed = document.getElementById('rollFeed');
  if (!feed) return;

  const item = document.createElement('li');
  item.className = 'feed-item';

  const diceMarkup = message.dice
    .map(die => `<span class="mini-die ${die.kept ? 'kept' : ''}">d${die.sides}: ${formatSymbolsHTML(die.symbols, true)}</span>`)
    .join('');

  item.innerHTML = `
    <div class="feed-item-head">
      <strong>${message.player}</strong>
      <span class="muted">${message.timestamp || ''}</span>
    </div>
    <div class="muted">${message.testLabel}</div>
    <div class="feed-dice-row">${diceMarkup}</div>
    <div class="feed-totals" style="display:flex; gap:10px; margin-top:4px;">
      <span class="sym-badge sym-A">${message.totals.A} ${getSymbolIcon('A', true)}</span>
      <span class="sym-badge sym-B">${message.totals.B} ${getSymbolIcon('B', true)}</span>
      <span class="sym-badge sym-C">${message.totals.C} ${getSymbolIcon('C', true)}</span>
    </div>
  `;

  feed.prepend(item);
}

async function bootstrapApp() {
  await AssimilacaoModule.init();

  const viewport = document.getElementById('systemViewport');
  AssimilacaoModule.render(viewport, roomSession);

  roomSession.onRoll(renderFeedEntry);

  document.getElementById('btnJoinRoom')?.addEventListener('click', () => {
    const input = document.getElementById('roomCode');
    roomSession.connect(input?.value.trim() || 'mesa-01');
  });

  document.getElementById('btnClearFeed')?.addEventListener('click', () => {
    const feed = document.getElementById('rollFeed');
    if (feed) feed.innerHTML = '';
  });
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
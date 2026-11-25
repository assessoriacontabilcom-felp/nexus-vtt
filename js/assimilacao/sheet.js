import { CONSTANTS, SYMBOLS_SVG, countSym, getSymbolIcon, formatSymbolsHTML, getDerivedStats, computeFinalTotals } from './rules.js';
import { openTraitModal, openAssimilationModal, openItemsModal } from './modals.js';

export const AssimilacaoModule = {
  id: 'assimilacao',
  name: 'Assimilação RPG',
  activePage: 'frente',
  state: {
    nome: '', eventoMarcante: '', ocupacao: '', geracao: 'Pós-Colapso',
    eventoUsado: false, ocupacaoUsada: false,
    propositoPessoal1: '', propositoPessoal2: '', propositoColetivo: '',
    instintos: [1, 1, 1, 1, 1, 1], conhecimentos: [0, 0, 0, 0, 0, 0], praticas: [0, 0, 0, 0, 0, 0],
    nivelDeterminacao: 9, pontosDeterminacao: 9, pontosAssimilacao: 1, danoSofrido: 0,
    caracteristicas: Array.from({ length: 6 }, () => ({ name: '', desc: '', effect: null })),
    assimilacoes: ['', '', '', ''],
    inventarioSlots: Array(10).fill(false),
    inventarioTexto: '', anotacoes: ''
  },
  catalogs: { caracteristicas: [], itens: {}, assimilacoes: {} },
  customTraits: [],
  pendingRoll: null,

  async init() {
    try {
      const saved = localStorage.getItem('nexus_assimilacao_v5');
      if (saved) this.state = { ...this.state, ...JSON.parse(saved) };
      const savedCat = localStorage.getItem('nexus_custom_traits_v2');
      if (savedCat) this.customTraits = JSON.parse(savedCat);

      const [rCar, rItens, rAssim] = await Promise.all([
     fetch('./data/caracteristicas.json'),
     fetch('./data/itens.json'),
     fetch('./data/assimilacoes.json')
   ]);

      if (!rCar.ok) throw new Error(`HTTP ${rCar.status} em /data/caracteristicas.json`);
      this.catalogs.caracteristicas = await rCar.json();
      if (rItens.ok) this.catalogs.itens = await rItens.json();
      if (rAssim.ok) this.catalogs.assimilacoes = await rAssim.json();
    } catch (e) {
      console.error('Erro ao carregar catálogos JSON:', e);
    }
  },

  saveState() { localStorage.setItem('nexus_assimilacao_v5', JSON.stringify(this.state)); },
  saveCustomTraits() { localStorage.setItem('nexus_custom_traits_v2', JSON.stringify(this.customTraits)); },
  getAllTraits() {
    return [...this.customTraits, ...this.catalogs.caracteristicas];
  },

  render(container, transport) {
    this.transport = transport;
    const { INSTINTOS, CONHECIMENTOS, PRATICAS } = CONSTANTS;

    container.innerHTML = `
      <div class="roller-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--paper-line); padding-bottom:6px; margin-bottom:10px;">
          <h2 style="border:none; margin:0; padding:0;">Rolador de Testes</h2>
          <div style="display:flex; gap:12px; align-items:center; font-size:0.8rem;">
            <span class="sym-badge sym-A">${getSymbolIcon('A', true)} Sucesso</span>
            <span class="sym-badge sym-B">${getSymbolIcon('B', true)} Adaptação</span>
            <span class="sym-badge sym-C">${getSymbolIcon('C', true)} Pressão</span>
          </div>
        </div>
        <div class="roller-controls">
          <label><strong>Instinto:</strong> <select id="rollIns1">${INSTINTOS.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
          <label id="wrapSkill"><strong>Perícia:</strong>
            <select id="rollSkill">
              <optgroup label="Conhecimentos">${CONHECIMENTOS.map((n, i) => `<option value="c-${i}">${n}</option>`).join('')}</optgroup>
              <optgroup label="Práticas">${PRATICAS.map((n, i) => `<option value="p-${i}">${n}</option>`).join('')}</optgroup>
            </select>
          </label>
          <label id="wrapIns2" style="display:none;"><strong>2º Instinto:</strong> <select id="rollIns2">${INSTINTOS.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
          <label><input type="checkbox" id="chkInstinto" /> Agir por Instinto</label>
          <label><input type="checkbox" id="chkEmpenho" /> Empenho</label>
          <label><strong>Origem:</strong> <select id="rollOrigem"></select></label>
        </div>
        <div id="activeTraitsBar" class="roller-controls" style="gap:6px;"></div>
        <div class="roller-controls">
          <button id="btnRoll" class="btn btn-primary">Rolar Dados</button>
          <button id="btnCancelRoll" class="btn btn-danger" style="display:none;">Cancelar & Reembolsar</button>
          <span id="rollNote" class="muted" style="color:var(--col-det); font-weight:600;"></span>
        </div>
        <div id="diceTray" class="dice-tray"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div id="rollTotalPreview"></div>
          <button id="btnConfirmRoll" class="btn btn-primary" disabled>Confirmar & Enviar à Mesa</button>
        </div>
      </div>

      <div class="sheet-tabs">
        <button type="button" class="tab-btn ${this.activePage === 'frente' ? 'active' : ''}" data-page="frente">1. Frente (Aptidões & Saúde)</button>
        <button type="button" class="tab-btn ${this.activePage === 'verso' ? 'active' : ''}" data-page="verso">2. Verso (Características & Assimilações)</button>
      </div>
      <div id="sheetPaperHost" class="sheet-paper"></div>
    `;

    const chkInst = container.querySelector('#chkInstinto');
    chkInst.onchange = () => {
      container.querySelector('#wrapSkill').style.display = chkInst.checked ? 'none' : 'inline-block';
      container.querySelector('#wrapIns2').style.display = chkInst.checked ? 'inline-block' : 'none';
      this.refreshApplicableTraits();
    };
    ['#rollIns1', '#rollIns2', '#rollSkill'].forEach(s => container.querySelector(s).onchange = () => this.refreshApplicableTraits());
    container.querySelector('#btnRoll').onclick = () => this.executeRoll();
    container.querySelector('#btnCancelRoll').onclick = () => this.cancelRoll();
    container.querySelector('#btnConfirmRoll').onclick = () => this.confirmRoll();
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        this.activePage = btn.dataset.page;
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === this.activePage));
        this.renderActiveSheetPage();
      };
    });

    this.refreshOriginSelect();
    this.refreshApplicableTraits();
    this.renderActiveSheetPage();
  },

  renderActiveSheetPage() {
    const host = document.getElementById('sheetPaperHost');
    if (host) this.activePage === 'frente' ? this.renderFrontPage(host) : this.renderBackPage(host);
  },

  renderFrontPage(host) {
    const s = this.state;
    host.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-logo">
          <div class="logo-mark">A</div><div class="logo-sub">ASSIMILAÇÃO</div>
          <button id="btnNewSession" class="btn btn-ghost btn-sm" style="margin-top:10px;">Nova Sessão</button>
        </div>
        <div class="lined-fields">
          <div class="lined-row"><label>Nome:</label><input type="text" id="inpNome" value="${s.nome}" placeholder="Nome do Infectado(a)" /></div>
          <div class="section-tag">ORIGENS</div>
          <div class="lined-row"><label>Evento Marcante:</label><input type="text" id="inpEvento" value="${s.eventoMarcante}" /></div>
          <div class="lined-row"><label>Ocupação:</label><input type="text" id="inpOcupacao" value="${s.ocupacao}" /></div>
          <div class="lined-row"><label>Geração:</label><input type="text" id="inpGeracao" value="${s.geracao}" /></div>
          <div class="lined-row"><label>Propósitos Pessoais:</label><input type="text" id="inpProp1" value="${s.propositoPessoal1}" /></div>
          <div class="lined-row"><input type="text" id="inpProp2" value="${s.propositoPessoal2}" placeholder="Segundo propósito..." /></div>
          <div class="lined-row"><label>Propósito Coletivo:</label><input type="text" id="inpPropCol" value="${s.propositoColetivo}" /></div>
        </div>
      </div>
      <div class="sheet-body">
        <div>
          <div class="big-section-title">APTIDÕES</div>
          <div class="sub-group-title" style="color:var(--col-instinto);">INSTINTOS ■</div><div class="apt-grid" id="gridInstintos"></div>
          <div class="sub-group-title" style="color:var(--col-pericia);">CONHECIMENTOS ♦</div><div class="apt-grid pericia" id="gridConhecimentos"></div>
          <div class="sub-group-title" style="color:var(--col-pericia);">PRÁTICAS ♦</div><div class="apt-grid pericia" id="gridPraticas"></div>
        </div>
        <div>
          <div class="health-header-bar">
            <div class="total-hp-drop"><span id="valTotalHp">30</span></div>
            <div><div class="big-section-title" style="margin:0;">SAÚDE</div><div class="muted" style="font-size:0.72rem; text-align:center;">1 + Potência + Resolução (<strong id="valPvLvl">5</strong>/nível)</div></div>
          </div>
          <div class="health-tier-note">Ativa Recuperação após repouso completo</div><div class="health-pair" id="healthPairTop"></div>
          <div class="health-tier-note">Ativa Recuperação após uma semana</div><div class="health-pair" id="healthPairMid"></div>
          <div class="health-tier-note">Não regenera naturalmente. Necessário tratamento médico.</div><div class="health-pair" id="healthPairBot"></div>
        </div>
      </div>
      <div class="tug-footer">
        <div class="tug-labels">
          <span style="color:var(--col-det);">Determinação <small class="muted">(Pts: <strong id="valDp">${s.pontosDeterminacao}</strong>)</small></span>
          <span style="color:var(--col-ass);"><small class="muted">(Pts: <strong id="valAp">${s.pontosAssimilacao}</strong>)</small> Assimilação</span>
        </div>
        <div class="tug-track">
          <div class="tug-circle det" id="btnSpendDet">${s.nivelDeterminacao}</div>
          <div class="tug-diamonds" id="tugDiamonds"></div>
          <div class="tug-circle ass" id="btnSpendAss">${10 - s.nivelDeterminacao}</div>
        </div>
      </div>
    `;

    [['#inpNome', 'nome'], ['#inpEvento', 'eventoMarcante', true], ['#inpOcupacao', 'ocupacao', true], ['#inpGeracao', 'geracao'], ['#inpProp1', 'propositoPessoal1'], ['#inpProp2', 'propositoPessoal2'], ['#inpPropCol', 'propositoColetivo']]
      .forEach(([id, key, ori]) => {
        host.querySelector(id).oninput = (e) => { s[key] = e.target.value; this.saveState(); if (ori) this.refreshOriginSelect(); };
      });

    host.querySelector('#btnNewSession').onclick = () => { s.eventoUsado = s.ocupacaoUsada = false; this.saveState(); this.refreshOriginSelect(); };
    const detC = host.querySelector('#btnSpendDet');
    detC.onclick = () => { s.pontosDeterminacao = Math.max(0, s.pontosDeterminacao - 1); this.saveState(); this.refreshFrontUI(); };
    detC.oncontextmenu = (e) => { e.preventDefault(); s.pontosDeterminacao = Math.min(10, s.pontosDeterminacao + 1); this.saveState(); this.refreshFrontUI(); };
    const assC = host.querySelector('#btnSpendAss');
    assC.onclick = () => { s.pontosAssimilacao = Math.max(0, s.pontosAssimilacao - 1); this.saveState(); this.refreshFrontUI(); };
    assC.oncontextmenu = (e) => { e.preventDefault(); s.pontosAssimilacao = Math.min(10, s.pontosAssimilacao + 1); this.saveState(); this.refreshFrontUI(); };

    this.refreshFrontUI();
  },

  refreshFrontUI() {
    if (this.activePage !== 'frente') return;
    const s = this.state, d = getDerivedStats(s);

    const drawGrid = (id, labels, arr, min, dia) => {
      const host = document.getElementById(id); host.innerHTML = '';
      labels.forEach((name, idx) => {
        const cell = document.createElement('div'); cell.className = 'apt-cell';
        cell.innerHTML = `<div class="apt-cell-head">${name}</div>`;
        const row = document.createElement('div'); row.className = 'pips-row';
        for (let l = 1; l <= 5; l++) {
          const b = document.createElement('button'); b.type = 'button';
          b.className = `pip ${dia ? 'diamond' : ''} ${arr[idx] >= l ? 'filled' : ''}`;
          b.onclick = () => { arr[idx] = arr[idx] === l ? Math.max(min, l - 1) : l; this.saveState(); this.refreshFrontUI(); };
          row.appendChild(b);
        }
        cell.appendChild(row); host.appendChild(cell);
      });
    };

    drawGrid('gridInstintos', CONSTANTS.INSTINTOS, s.instintos, 1, false);
    drawGrid('gridConhecimentos', CONSTANTS.CONHECIMENTOS, s.conhecimentos, 0, true);
    drawGrid('gridPraticas', CONSTANTS.PRATICAS, s.praticas, 0, true);

    document.getElementById('valTotalHp').textContent = d.pvTotal;
    document.getElementById('valPvLvl').textContent = d.pvPorNivel;

    const box = (idx, cls, foot = '') => {
      let drops = '';
      for (let st = 1; st <= d.pvPorNivel; st++) {
        const dmg = idx * d.pvPorNivel + st;
        drops += `<button type="button" class="hp-drop ${s.danoSofrido >= dmg ? 'filled' : ''}" data-dmg="${dmg}"></button>`;
      }
      return `<div class="health-box ${cls} ${idx === d.nivelAtualIdx ? 'current-tier' : ''}"><div class="health-box-head"><span class="tier-num">${6 - idx}</span> ${CONSTANTS.SAUDE_NIVEIS[idx]}</div><div class="drops-row">${drops}</div>${foot ? `<div class="health-penalty-foot">${foot}</div>` : ''}</div>`;
    };

    document.getElementById('healthPairTop').innerHTML = box(0, 'tier-6') + box(1, 'tier-6');
    document.getElementById('healthPairMid').innerHTML = box(2, 'tier-4') + box(3, 'tier-4', 'Menos 1 dado em todos os testes');
    document.getElementById('healthPairBot').innerHTML = box(4, 'tier-2', 'Incapaz de agir. -2 dados.') + box(5, 'tier-2', 'Inconsciente. Ação exige 2 Assimilação.');
    document.querySelectorAll('.hp-drop').forEach(b => b.onclick = () => { const t = Number(b.dataset.dmg); s.danoSofrido = s.danoSofrido === t ? t - 1 : t; this.saveState(); this.refreshFrontUI(); });

    document.getElementById('valDp').textContent = s.pontosDeterminacao;
    document.getElementById('valAp').textContent = s.pontosAssimilacao;
    document.getElementById('btnSpendDet').textContent = s.nivelDeterminacao;
    document.getElementById('btnSpendAss').textContent = d.nivelAssimilacao;

    const tug = document.getElementById('tugDiamonds'); tug.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const isDet = i <= s.nivelDeterminacao, col = isDet ? '#8c2318' : '#1d4e5f';
      const n = document.createElement('button'); n.type = 'button'; n.className = 'tug-node';
      n.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="1,12 11,4 11,20" fill="${isDet ? col : 'none'}" stroke="${col}" stroke-width="2"/><polygon points="23,12 13,4 13,20" fill="${!isDet ? col : 'none'}" stroke="${col}" stroke-width="2"/></svg>`;
      n.onclick = () => { s.nivelDeterminacao = s.nivelDeterminacao === i ? i - 1 : i; this.saveState(); this.refreshFrontUI(); };
      tug.appendChild(n);
    }
  },

  renderBackPage(host) {
    const s = this.state;
    const badges = [
      { key: 'evolutivas', icon: getSymbolIcon('A', true), suit: '♥', label: 'Evolutivas' },
      { key: 'adaptativas', icon: getSymbolIcon('B', true), suit: '♦', label: 'Adaptativas' },
      { key: 'inoportunas', icon: getSymbolIcon('C', true), suit: '♠', label: 'Inoportunas' },
      { key: 'singulares', icon: SYMBOLS_SVG.TREE, suit: '♣', label: 'Singulares' }
    ];

    host.innerHTML = `
      <div style="text-align:center;"><div class="ribbon-title ribbon-red">CARACTERÍSTICAS</div></div>
      <div class="traits-grid">
        ${s.caracteristicas.map((tr, i) => `
          <div class="trait-slot">
            <div class="trait-head-row">
              <input type="text" class="trait-name-box" data-tidx="${i}" value="${tr.name}" placeholder="Nome da Característica..." />
              <button type="button" class="btn btn-ghost btn-sm btn-pick-trait" data-tidx="${i}">+ Catálogo</button>
              ${tr.name || tr.desc ? `<button type="button" class="btn btn-danger btn-sm btn-clear-trait" data-tidx="${i}">×</button>` : ''}
            </div>
            <textarea class="trait-desc-lines" data-tidx="${i}" placeholder="Descrição...">${tr.desc}</textarea>
          </div>
        `).join('')}
      </div>
      <div class="verso-bottom-grid">
        <div>
          <div style="text-align:center;"><div class="ribbon-title ribbon-teal">ASSIMILAÇÕES</div></div>
          <div class="assim-stack">
            ${badges.map((b, i) => `
              <div class="assim-slot">
                <div style="display:flex; flex-direction:column;">
                  <textarea data-aidx="${i}" style="flex:1;" placeholder="Mutações ${b.label}...">${s.assimilacoes[i] || ''}</textarea>
                  <div style="padding:2px 8px 6px; text-align:right;"><button type="button" class="btn btn-ghost btn-sm btn-pick-assim" data-aidx="${i}" data-cat="${b.key}">+ ${b.label}</button></div>
                </div>
                <div class="assim-badge-col"><span>${b.icon}</span><span>${b.suit}</span></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div>
          <div style="text-align:center;"><div class="ribbon-title ribbon-ochre">ESPAÇOS DE INVENTÁRIO</div></div>
          <div class="inv-grid-boxes">${s.inventarioSlots.map((u, i) => `<button type="button" class="inv-box ${u ? 'used' : ''}" data-sidx="${i}">${u ? '✓' : ''}</button>`).join('')}</div>
          <div style="text-align:right; margin-bottom:4px;"><button type="button" class="btn btn-ghost btn-sm" id="btnPickItems">+ Pacotes / Itens</button></div>
          <textarea id="inpInvText" class="inv-items-input" placeholder="Equipamentos...">${s.inventarioTexto}</textarea>
          <div style="text-align:center;"><div class="ribbon-title ribbon-ochre">ANOTAÇÕES</div></div>
          <textarea id="inpAnotacoes" class="notes-paper-box" placeholder="Anotações...">${s.anotacoes}</textarea>
        </div>
      </div>
    `;

    host.querySelectorAll('.trait-name-box').forEach(el => el.oninput = () => { const i = Number(el.dataset.tidx); s.caracteristicas[i].name = el.value; s.caracteristicas[i].effect = null; this.saveState(); this.refreshApplicableTraits(); });
    host.querySelectorAll('.trait-desc-lines').forEach(el => el.oninput = () => { s.caracteristicas[Number(el.dataset.tidx)].desc = el.value; this.saveState(); });
    host.querySelectorAll('.btn-pick-trait').forEach(b => b.onclick = () => openTraitModal(this, Number(b.dataset.tidx)));
    host.querySelectorAll('.btn-clear-trait').forEach(b => b.onclick = () => { s.caracteristicas[Number(b.dataset.tidx)] = { name: '', desc: '', effect: null }; this.saveState(); this.renderBackPage(host); this.refreshApplicableTraits(); });
    host.querySelectorAll('.assim-slot textarea').forEach(el => el.oninput = () => { s.assimilacoes[Number(el.dataset.aidx)] = el.value; this.saveState(); });
    host.querySelectorAll('.btn-pick-assim').forEach(b => b.onclick = () => openAssimilationModal(this, Number(b.dataset.aidx), b.dataset.cat));
    host.querySelectorAll('.inv-box').forEach(b => b.onclick = () => { const i = Number(b.dataset.sidx); s.inventarioSlots[i] = !s.inventarioSlots[i]; this.saveState(); this.renderBackPage(host); });
    host.querySelector('#btnPickItems').onclick = () => openItemsModal(this);
    host.querySelector('#inpInvText').oninput = (e) => { s.inventarioTexto = e.target.value; this.saveState(); };
    host.querySelector('#inpAnotacoes').oninput = (e) => { s.anotacoes = e.target.value; this.saveState(); };
  },

  getApplicableTraits() {
    const ins1 = CONSTANTS.INSTINTOS[Number(document.getElementById('rollIns1')?.value || 0)];
    const agirIns = document.getElementById('chkInstinto')?.checked;
    const ins2 = agirIns ? CONSTANTS.INSTINTOS[Number(document.getElementById('rollIns2')?.value || 0)] : null;
    let skill = null;
    if (!agirIns) {
      const [t, i] = (document.getElementById('rollSkill')?.value || 'c-0').split('-');
      skill = t === 'c' ? CONSTANTS.CONHECIMENTOS[Number(i)] : CONSTANTS.PRATICAS[Number(i)];
    }
    const cat = this.getAllTraits();
    return this.state.caracteristicas.map((slot, slotIdx) => {
      if (!slot.name) return null;
      const m = slot.effect ? slot : cat.find(t => t.name.toLowerCase() === slot.name.trim().toLowerCase());
      if (!m?.effect) return null;
      const e = m.effect;
      const ok = e.when === 'always' || e.when === `ins:${ins1}` || (ins2 && e.when === `ins:${ins2}`) || (skill && e.when === `skill:${skill}`);
      return ok ? { slotIdx, name: slot.name, effect: e } : null;
    }).filter(Boolean);
  },

  refreshApplicableTraits() {
    const bar = document.getElementById('activeTraitsBar'); if (!bar) return;
    const app = this.getApplicableTraits();
    bar.innerHTML = app.length ? `<span class="muted" style="font-weight:600;">Características:</span>${app.map(t => `<label style="display:inline-flex;align-items:center;gap:5px;background:#ede6d6;border:1px solid var(--col-instinto);padding:2px 8px;border-radius:99px;font-size:0.8rem;cursor:pointer;"><input type="checkbox" class="chk-trait-bonus" data-slot="${t.slotIdx}" checked /><strong>${t.name}</strong> <span class="muted">(${t.effect.label})</span></label>`).join('')}` : '';
  },

  refreshOriginSelect() {
    const s = this.state, sel = document.getElementById('rollOrigem'); if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">Nenhuma</option><option value="evento" ${s.eventoUsado ? 'disabled' : ''}>Evento: ${s.eventoMarcante || '—'}</option><option value="ocupacao" ${s.ocupacaoUsada ? 'disabled' : ''}>Ocupação: ${s.ocupacao || '—'}</option>`;
    sel.value = prev && !sel.querySelector(`option[value="${prev}"]`)?.disabled ? prev : '';
  },

  executeRoll() {
    if (this.pendingRoll) this.cancelRoll();
    const s = this.state, note = document.getElementById('rollNote'); note.textContent = '';
    const i1 = Number(document.getElementById('rollIns1').value), inst = document.getElementById('chkInstinto').checked, emp = document.getElementById('chkEmpenho').checked, ori = document.getElementById('rollOrigem').value;
    const app = this.getApplicableTraits(), active = [...document.querySelectorAll('.chk-trait-bonus:checked')].map(c => app.find(a => a.slotIdx === Number(c.dataset.slot))).filter(Boolean);
    const spent = { ap: 0, dp: 0, origem: '' }, pool = [], fb = { A: 0, B: 0, ignoreC: 0, bToA: 0, cToB: 0, extraDice: 0 };
    let keep = 1, label = '';

    active.forEach(({ effect: e }) => {
      if (e.type === 'addA') fb.A += e.value;
      if (e.type === 'addB') fb.B += e.value;
      if (e.type === 'bToA') fb.bToA += e.value;
      if (e.type === 'ignoreC') fb.ignoreC += e.value;
      if (e.type === 'cToB') fb.cToB += e.value;
      if (e.type === 'extraDie') fb.extraDice += e.value;
      if (e.type === 'extraKeep') keep += e.value;
    });

    if (inst) {
      const i2 = Number(document.getElementById('rollIns2').value);
      if (s.pontosAssimilacao >= 1) { s.pontosAssimilacao--; spent.ap = 1; }
      else if (s.pontosDeterminacao >= 2) { s.pontosDeterminacao -= 2; spent.dp = 2; }
      else { note.textContent = 'Sem pontos para Agir por Instinto.'; return; }
      for (let k = 0; k < s.instintos[i1] + s.instintos[i2] + fb.extraDice; k++) pool.push(12);
      keep++; label = `${CONSTANTS.INSTINTOS[i1]} + ${CONSTANTS.INSTINTOS[i2]} (Por Instinto)`;
    } else {
      const [t, idx] = document.getElementById('rollSkill').value.split('-');
      const val = t === 'c' ? s.conhecimentos[Number(idx)] : s.praticas[Number(idx)];
      for (let k = 0; k < s.instintos[i1]; k++) pool.push(6);
      for (let k = 0; k < val + fb.extraDice; k++) pool.push(10);
      label = `${CONSTANTS.INSTINTOS[i1]} + ${t === 'c' ? CONSTANTS.CONHECIMENTOS[Number(idx)] : CONSTANTS.PRATICAS[Number(idx)]}`;
    }

    if (emp) {
      if (s.pontosDeterminacao < 1) { s.pontosAssimilacao += spent.ap; s.pontosDeterminacao += spent.dp; note.textContent = 'Sem Determinação.'; return; }
      s.pontosDeterminacao--; spent.dp++; keep++; label += ' • Empenho';
    }
    if (ori === 'evento') { s.eventoUsado = true; spent.origem = 'evento'; keep++; label += ' • Evento'; }
    if (ori === 'ocupacao') { s.ocupacaoUsada = true; spent.origem = 'ocupacao'; keep++; label += ' • Ocupação'; }
    if (active.length) label += ` [${active.map(t => t.name).join(', ')}]`;

    const dice = pool.map(sides => ({ sides, symbols: CONSTANTS.FACES[sides][Math.floor(Math.random() * sides)] }));
    const sc = d => countSym(d.symbols, 'A') * 100 + countSym(d.symbols, 'B') * 10 - countSym(d.symbols, 'C') * 30;
    const sorted = dice.map((_, i) => i).sort((a, b) => sc(dice[b]) - sc(dice[a]));
    this.pendingRoll = { label, dice, keepCount: keep, selected: new Set(sorted.slice(0, keep)), spent, flatBonus: fb };
    this.saveState(); this.refreshFrontUI(); this.refreshOriginSelect(); this.renderPendingDice();
  },

  cancelRoll() {
    if (!this.pendingRoll) return;
    const { spent } = this.pendingRoll;
    this.state.pontosAssimilacao += spent.ap; this.state.pontosDeterminacao += spent.dp;
    if (spent.origem === 'evento') this.state.eventoUsado = false;
    if (spent.origem === 'ocupacao') this.state.ocupacaoUsada = false;
    this.pendingRoll = null; this.saveState(); this.refreshFrontUI(); this.refreshOriginSelect(); this.renderPendingDice();
  },

  renderPendingDice() {
    const tray = document.getElementById('diceTray'), prev = document.getElementById('rollTotalPreview'), btnC = document.getElementById('btnConfirmRoll'), btnX = document.getElementById('btnCancelRoll');
    tray.innerHTML = '';
    if (!this.pendingRoll) { prev.innerHTML = ''; btnC.disabled = true; btnX.style.display = 'none'; return; }
    btnX.style.display = 'inline-block';
    const { dice, keepCount, selected } = this.pendingRoll;

    dice.forEach((d, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `die-btn ${selected.has(i) ? 'kept' : ''}`;
      b.innerHTML = `<span class="die-type">d${d.sides}</span>${formatSymbolsHTML(d.symbols, false)}`;
      b.onclick = () => { selected.has(i) ? selected.delete(i) : (selected.add(i), selected.size > keepCount && selected.delete(selected.values().next().value)); this.renderPendingDice(); };
      tray.appendChild(b);
    });

    const tot = computeFinalTotals(this.pendingRoll);
    prev.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;"><strong>Mantidos (${selected.size}/${keepCount}):</strong><span class="sym-badge sym-A">${tot.A} ${getSymbolIcon('A', true)}</span><span class="sym-badge sym-B">${tot.B} ${getSymbolIcon('B', true)}</span><span class="sym-badge sym-C">${tot.C} ${getSymbolIcon('C', true)}</span></span>`;
    btnC.disabled = selected.size === 0;
  },

  async confirmRoll() {
    if (!this.pendingRoll) return;
    const { label, dice, selected } = this.pendingRoll;
    await this.transport.sendRoll({
      system: this.id, player: this.state.nome || 'Infectado(a)', testLabel: label,
      dice: dice.map((d, i) => ({ sides: d.sides, symbols: d.symbols, kept: selected.has(i) })),
      totals: computeFinalTotals(this.pendingRoll)
    });
    this.pendingRoll = null; this.renderPendingDice();
  }
};
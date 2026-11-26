import {
  SYSTEM_DATA,
  SYMBOL_ICONS,
  countSymbol,
  getSymbolIcon,
  formatSymbolsHTML,
  calculateDerivedStats,
  getHealthPenalty,
  calculateRollTotals,
  getEquippedMutations,
  getEffectiveAptitudes
} from './rules.js';
import { openTraitModal, openAssimilationModal, openItemsModal } from './modals.js';

const STORAGE_KEY = 'nexus_assimilacao_v1';
const CUSTOM_TRAITS_KEY = 'nexus_custom_traits_v1';

function createDefaultState() {
  return {
    name: '',
    definingEvent: '',
    occupation: '',
    generation: 'Pós-Colapso',
    eventUsed: false,
    occupationUsed: false,
    personalPurpose1: '',
    personalPurpose2: '',
    collectivePurpose: '',
    instincts: [1, 1, 1, 1, 1, 1],
    knowledges: [0, 0, 0, 0, 0, 0],
    practices: [0, 0, 0, 0, 0, 0],
    determinationLevel: 9,
    determinationPoints: 9,
    assimilationPoints: 1,
    damageTaken: 0,
    traits: Array.from({ length: 6 }, () => ({ name: '', desc: '', effect: null })),
    assimilations: ['', '', '', ''],
    inventorySlots: Array(10).fill(false),
    inventoryText: '',
    notes: ''
  };
}

export const AssimilacaoModule = {
  id: 'assimilacao',
  name: 'Assimilação RPG',
  activePage: 'frente',
  state: createDefaultState(),
  catalogs: { caracteristicas: [], itens: {}, assimilacoes: {} },
  customTraits: [],
  pendingRoll: null,

  async init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) this.state = { ...createDefaultState(), ...JSON.parse(saved) };

      const savedTraits = localStorage.getItem(CUSTOM_TRAITS_KEY);
      if (savedTraits) this.customTraits = JSON.parse(savedTraits);

      const [traitsRes, itemsRes, assimRes] = await Promise.all([
        fetch('./data/caracteristicas.json'),
        fetch('./data/itens.json'),
        fetch('./data/assimilacoes.json')
      ]);

      if (!traitsRes.ok) throw new Error(`Falha ao carregar caracteristicas.json (${traitsRes.status})`);
      this.catalogs.caracteristicas = await traitsRes.json();
      if (itemsRes.ok) this.catalogs.itens = await itemsRes.json();
      if (assimRes.ok) this.catalogs.assimilacoes = await assimRes.json();
    } catch (error) {
      console.error('Erro ao inicializar Assimilação RPG:', error);
    }
  },

  saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  saveCustomTraits() {
    localStorage.setItem(CUSTOM_TRAITS_KEY, JSON.stringify(this.customTraits));
  },

  getAllTraits() {
    return [...this.customTraits, ...this.catalogs.caracteristicas];
  },

  render(container, transport) {
    this.transport = transport;
    const { instincts, knowledges, practices } = SYSTEM_DATA;

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
          <label><strong>Instinto:</strong> <select id="rollIns1">${instincts.map((name, idx) => `<option value="${idx}">${name}</option>`).join('')}</select></label>
          <label id="wrapSkill"><strong>Perícia:</strong>
            <select id="rollSkill">
              <optgroup label="Conhecimentos">${knowledges.map((name, idx) => `<option value="c-${idx}">${name}</option>`).join('')}</optgroup>
              <optgroup label="Práticas">${practices.map((name, idx) => `<option value="p-${idx}">${name}</option>`).join('')}</optgroup>
            </select>
          </label>
          <label id="wrapIns2" style="display:none;"><strong>2º Instinto:</strong> <select id="rollIns2">${instincts.map((name, idx) => `<option value="${idx}">${name}</option>`).join('')}</select></label>
          <label><input type="checkbox" id="chkInstinto" /> Agir por Instinto</label>
          <label><input type="checkbox" id="chkEmpenho" /> Empenho</label>
          <label><strong>Origem:</strong> <select id="rollOrigem"></select></label>
        </div>
        <div id="activeTraitsBar" class="roller-controls" style="gap:6px;"></div>
        <div id="healthPenaltyBar" style="font-size:0.8rem; color:#8c2318; font-weight:700; margin-bottom:6px;"></div>
        <div class="roller-controls">
          <button id="btnRoll" class="btn btn-primary">Rolar Dados</button>
          <button id="btnReroll" class="btn btn-ghost" style="display:none;">Rerrolar (-1 Assim.)</button>
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

    this.bindRollerEvents(container);
    this.refreshOriginSelect();
    this.refreshApplicableTraits();
    this.refreshHealthPenaltyBanner();
    this.renderActiveSheetPage();
  },

  bindRollerEvents(container) {
    const instinctModeCheckbox = container.querySelector('#chkInstinto');
    instinctModeCheckbox.addEventListener('change', () => {
      const isInstinctAction = instinctModeCheckbox.checked;
      container.querySelector('#wrapSkill').style.display = isInstinctAction ? 'none' : 'inline-block';
      container.querySelector('#wrapIns2').style.display = isInstinctAction ? 'inline-block' : 'none';
      this.refreshApplicableTraits();
    });

    ['#rollIns1', '#rollIns2', '#rollSkill'].forEach(selector => {
      container.querySelector(selector)?.addEventListener('change', () => this.refreshApplicableTraits());
    });

    container.querySelector('#btnRoll').addEventListener('click', () => this.executeRoll());
    container.querySelector('#btnReroll').addEventListener('click', () => this.rerollPendingDice());
    container.querySelector('#btnConfirmRoll').addEventListener('click', () => this.confirmRoll());

    container.querySelectorAll('.tab-btn').forEach(button => {
      button.addEventListener('click', () => {
        this.activePage = button.dataset.page;
        container.querySelectorAll('.tab-btn').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.page === this.activePage);
        });
        this.renderActiveSheetPage();
      });
    });
  },

  refreshHealthPenaltyBanner() {
    const banner = document.getElementById('healthPenaltyBar');
    if (!banner) return;
    const { warning } = getHealthPenalty(this.state, this.catalogs.assimilacoes);
    banner.textContent = warning ? `⚠️ ${warning}` : '';
  },

  renderActiveSheetPage() {
    const host = document.getElementById('sheetPaperHost');
    if (!host) return;
    if (this.activePage === 'frente') {
      this.renderFrontPage(host);
    } else {
      this.renderBackPage(host);
    }
  },

  renderFrontPage(host) {
    const char = this.state;
    host.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-logo">
          <div class="logo-mark">A</div>
          <div class="logo-sub">ASSIMILAÇÃO</div>
          <button id="btnNewSession" class="btn btn-ghost btn-sm" style="margin-top:10px;">Nova Sessão</button>
        </div>
        <div class="lined-fields">
          <div class="lined-row"><label>Nome:</label><input type="text" id="inpNome" value="${char.name}" placeholder="Nome do Infectado(a)" /></div>
          <div class="section-tag">ORIGENS</div>
          <div class="lined-row"><label>Evento Marcante:</label><input type="text" id="inpEvento" value="${char.definingEvent}" /></div>
          <div class="lined-row"><label>Ocupação:</label><input type="text" id="inpOcupacao" value="${char.occupation}" /></div>
          <div class="lined-row"><label>Geração:</label><input type="text" id="inpGeracao" value="${char.generation}" /></div>
          <div class="lined-row"><label>Propósitos Pessoais:</label><input type="text" id="inpProp1" value="${char.personalPurpose1}" /></div>
          <div class="lined-row"><input type="text" id="inpProp2" value="${char.personalPurpose2}" placeholder="Segundo propósito..." /></div>
          <div class="lined-row"><label>Propósito Coletivo:</label><input type="text" id="inpPropCol" value="${char.collectivePurpose}" /></div>
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
            <div class="total-hp-drop" title="Saúde Atual / Máxima"><span id="valTotalHp">18</span></div>
            <div>
              <div class="big-section-title" style="margin:0;">SAÚDE</div>
              <div class="muted" style="font-size:0.72rem; text-align:center;">1 + Potência + Resolução (<strong id="valPvLvl">3</strong>/nível • Máx: <strong id="valMaxHp">18</strong>)</div>
            </div>
          </div>
          <div class="health-tier-note">Ativa Recuperação após repouso completo</div><div class="health-pair" id="healthPairTop"></div>
          <div class="health-tier-note">Ativa Recuperação após uma semana</div><div class="health-pair" id="healthPairMid"></div>
          <div class="health-tier-note">Não regenera naturalmente. Necessário tratamento médico.</div><div class="health-pair" id="healthPairBot"></div>
        </div>
      </div>
      <div class="tug-footer">
        <div class="tug-labels">
          <span style="color:var(--col-det);">Determinação <small class="muted">(Pts: <strong id="valDp">${char.determinationPoints}</strong>)</small></span>
          <span style="color:var(--col-ass);"><small class="muted">(Pts: <strong id="valAp">${char.assimilationPoints}</strong>)</small> Assimilação</span>
        </div>
        <div class="tug-track">
          <div class="tug-circle det" id="btnSpendDet">${char.determinationLevel}</div>
          <div class="tug-diamonds" id="tugDiamonds"></div>
          <div class="tug-circle ass" id="btnSpendAss">${10 - char.determinationLevel}</div>
        </div>
      </div>
    `;

    this.bindFrontInputs(host);
    this.refreshFrontUI();
  },

  bindFrontInputs(host) {
    const char = this.state;
    const textBindings = [
      ['#inpNome', 'name', false],
      ['#inpEvento', 'definingEvent', true],
      ['#inpOcupacao', 'occupation', true],
      ['#inpGeracao', 'generation', false],
      ['#inpProp1', 'personalPurpose1', false],
      ['#inpProp2', 'personalPurpose2', false],
      ['#inpPropCol', 'collectivePurpose', false]
    ];

    textBindings.forEach(([selector, field, updatesOrigin]) => {
      host.querySelector(selector)?.addEventListener('input', (event) => {
        char[field] = event.target.value;
        this.saveState();
        if (updatesOrigin) this.refreshOriginSelect();
      });
    });

    host.querySelector('#btnNewSession')?.addEventListener('click', () => {
      char.eventUsed = false;
      char.occupationUsed = false;
      this.saveState();
      this.refreshOriginSelect();
    });

    const detCircle = host.querySelector('#btnSpendDet');
    detCircle.addEventListener('click', () => {
      char.determinationPoints = Math.max(0, char.determinationPoints - 1);
      this.saveState();
      this.refreshFrontUI();
    });
    detCircle.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      char.determinationPoints = Math.min(10, char.determinationPoints + 1);
      this.saveState();
      this.refreshFrontUI();
    });

    const assCircle = host.querySelector('#btnSpendAss');
    assCircle.addEventListener('click', () => {
      char.assimilationPoints = Math.max(0, char.assimilationPoints - 1);
      this.saveState();
      this.refreshFrontUI();
    });
    assCircle.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      char.assimilationPoints = Math.min(10, char.assimilationPoints + 1);
      this.saveState();
      this.refreshFrontUI();
    });
  },

  refreshFrontUI() {
    if (this.activePage !== 'frente') return;
    const char = this.state;
    const {
      instincts: effInstincts,
      knowledges: effKnowledges,
      practices: effPractices,
      modifiers
    } = getEffectiveAptitudes(char, this.catalogs.assimilacoes);

    let stats = calculateDerivedStats(char, this.catalogs.assimilacoes);

    if (char.damageTaken > stats.maxHp) {
      char.damageTaken = stats.maxHp;
      stats = calculateDerivedStats(char, this.catalogs.assimilacoes);
    }

    this.renderAptitudeGrid('gridInstintos', SYSTEM_DATA.instincts, char.instincts, 1, false, modifiers.instincts, effInstincts);
    this.renderAptitudeGrid('gridConhecimentos', SYSTEM_DATA.knowledges, char.knowledges, 0, true, modifiers.knowledges, effKnowledges);
    this.renderAptitudeGrid('gridPraticas', SYSTEM_DATA.practices, char.practices, 0, true, modifiers.practices, effPractices);

    document.getElementById('valTotalHp').textContent = stats.currentHp;
    document.getElementById('valMaxHp').textContent = stats.maxHp;
    document.getElementById('valPvLvl').textContent = stats.hpPerLevel;

    this.renderHealthBoxes(stats);
    this.refreshHealthPenaltyBanner();
    this.renderTugOfWar(stats);
  },

  renderAptitudeGrid(containerId, labels, baseValues, minLevel, isDiamond, groupMods, displayValues) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    labels.forEach((label, index) => {
      const maxForCell = groupMods.caps[index] || 5;
      const bonusForCell = groupMods.bonuses[index] || 0;
      const isZeroed = groupMods.zeroed[index];
      const shownValue = displayValues[index];

      const cell = document.createElement('div');
      cell.className = 'apt-cell';

      const pillStyle = 'background:#e8f4f8; color:#123845; padding:1px 6px; border-radius:99px; font-size:0.68rem; font-weight:700; margin-left:4px; vertical-align:middle;';
      const badge = isZeroed
        ? ` <span style="background:#f8d7da; color:#8c2318; padding:1px 6px; border-radius:99px; font-size:0.68rem; font-weight:700; margin-left:4px;">Zerado</span>`
        : bonusForCell !== 0
          ? ` <span style="${pillStyle}">${bonusForCell > 0 ? `+${bonusForCell}` : bonusForCell} Mutação</span>`
          : maxForCell > 5
            ? ` <span style="${pillStyle}">Máx 6</span>`
            : '';

      cell.innerHTML = `<div class="apt-cell-head">${label}${badge}</div>`;

      const pipsRow = document.createElement('div');
      pipsRow.className = 'pips-row';

      for (let level = 1; level <= maxForCell; level++) {
        const pip = document.createElement('button');
        pip.type = 'button';
        pip.className = `pip ${isDiamond ? 'diamond' : ''} ${shownValue >= level ? 'filled' : ''}`;

        if (level === 6) {
          pip.style.borderColor = '#1d4e5f';
          if (shownValue >= 6) pip.style.backgroundColor = '#1d4e5f';
        }

        pip.addEventListener('click', () => {
          if (isZeroed) return;
          const clickedBase = Math.max(minLevel, level - bonusForCell);
          baseValues[index] = shownValue === level ? Math.max(minLevel, clickedBase - 1) : clickedBase;
          this.saveState();
          this.refreshFrontUI();
        });
        pipsRow.appendChild(pip);
      }

      cell.appendChild(pipsRow);
      container.appendChild(cell);
    });
  },

  renderHealthBoxes(stats) {
    const char = this.state;
    const buildBox = (tierIndex, cssClass, footerNote = '') => {
      let dropsMarkup = '';
      for (let step = 1; step <= stats.hpPerLevel; step++) {
        const damageThreshold = tierIndex * stats.hpPerLevel + step;
        const isFilled = char.damageTaken >= damageThreshold ? 'filled' : '';
        dropsMarkup += `<button type="button" class="hp-drop ${isFilled}" data-dmg="${damageThreshold}"></button>`;
      }

      const isCurrentTier = tierIndex === stats.currentLevelIndex ? 'current-tier' : '';
      const footerMarkup = footerNote ? `<div class="health-penalty-foot">${footerNote}</div>` : '';

      return `
        <div class="health-box ${cssClass} ${isCurrentTier}">
          <div class="health-box-head"><span class="tier-num">${6 - tierIndex}</span> ${SYSTEM_DATA.healthLevels[tierIndex]}</div>
          <div class="drops-row">${dropsMarkup}</div>
          ${footerMarkup}
        </div>
      `;
    };

    document.getElementById('healthPairTop').innerHTML = buildBox(0, 'tier-6') + buildBox(1, 'tier-6');
    document.getElementById('healthPairMid').innerHTML = buildBox(2, 'tier-4') + buildBox(3, 'tier-4', 'Menos 1 dado em todos os testes');
    document.getElementById('healthPairBot').innerHTML = buildBox(4, 'tier-2', 'Incapaz de agir. -2 dados.') + buildBox(5, 'tier-2', 'Inconsciente. Ação exige 2 Assimilação.');

    document.querySelectorAll('.hp-drop').forEach(dropBtn => {
      dropBtn.addEventListener('click', () => {
        const targetDamage = Number(dropBtn.dataset.dmg);
        char.damageTaken = char.damageTaken === targetDamage ? targetDamage - 1 : targetDamage;
        this.saveState();
        this.refreshFrontUI();
      });
    });
  },

  renderTugOfWar(stats) {
    const char = this.state;
    document.getElementById('valDp').textContent = char.determinationPoints;
    document.getElementById('valAp').textContent = char.assimilationPoints;
    document.getElementById('btnSpendDet').textContent = char.determinationLevel;
    document.getElementById('btnSpendAss').textContent = stats.assimilationLevel;

    const track = document.getElementById('tugDiamonds');
    track.innerHTML = '';

    for (let step = 1; step <= 10; step++) {
      const isDetermination = step <= char.determinationLevel;
      const strokeColor = isDetermination ? '#8c2318' : '#1d4e5f';
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'tug-node';
      node.innerHTML = `
        <svg viewBox="0 0 24 24">
          <polygon points="1,12 11,4 11,20" fill="${isDetermination ? strokeColor : 'none'}" stroke="${strokeColor}" stroke-width="2"/>
          <polygon points="23,12 13,4 13,20" fill="${!isDetermination ? strokeColor : 'none'}" stroke="${strokeColor}" stroke-width="2"/>
        </svg>
      `;
      node.addEventListener('click', () => {
        char.determinationLevel = char.determinationLevel === step ? step - 1 : step;
        this.saveState();
        this.refreshFrontUI();
        this.refreshApplicableTraits();
      });
      track.appendChild(node);
    }
  },

  renderBackPage(host) {
    const char = this.state;
    const assimilationCategories = [
      { key: 'evolutivas', icon: getSymbolIcon('A', true), suit: '♥', label: 'Evolutivas' },
      { key: 'adaptativas', icon: getSymbolIcon('B', true), suit: '♦', label: 'Adaptativas' },
      { key: 'inoportunas', icon: getSymbolIcon('C', true), suit: '♠', label: 'Inoportunas' },
      { key: 'singulares', icon: SYMBOL_ICONS.TREE, suit: '♣', label: 'Singulares' }
    ];

    const equippedMuts = getEquippedMutations(char, this.catalogs.assimilacoes);
    const activeAbilities = equippedMuts.flatMap(mut =>
      mut.effects
        .filter(eff => eff.type === 'activeAction')
        .map(eff => ({ mutName: mut.name, ...eff }))
    );

    host.innerHTML = `
      <div style="text-align:center;"><div class="ribbon-title ribbon-red">CARACTERÍSTICAS</div></div>
      <div class="traits-grid">
        ${char.traits.map((trait, index) => `
          <div class="trait-slot">
            <div class="trait-head-row">
              <input type="text" class="trait-name-box" data-tidx="${index}" value="${trait.name}" placeholder="Nome da Característica..." />
              <button type="button" class="btn btn-ghost btn-sm btn-pick-trait" data-tidx="${index}">+ Catálogo</button>
              ${trait.name || trait.desc ? `<button type="button" class="btn btn-danger btn-sm btn-clear-trait" data-tidx="${index}">×</button>` : ''}
            </div>
            <textarea class="trait-desc-lines" data-tidx="${index}" placeholder="Descrição...">${trait.desc}</textarea>
          </div>
        `).join('')}
      </div>
      <div class="verso-bottom-grid">
        <div>
          <div style="text-align:center;"><div class="ribbon-title ribbon-teal">ASSIMILAÇÕES</div></div>
          ${activeAbilities.length ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
              ${activeAbilities.map((ab, idx) => `
                <button type="button" class="btn btn-ghost btn-sm btn-use-mutation" data-abidx="${idx}" style="border-color:var(--col-ass); color:var(--col-ass); font-weight:700;">
                  ⚡ ${ab.mutName}: ${ab.label}
                </button>
              `).join('')}
            </div>
          ` : ''}
          <div class="assim-stack">
            ${assimilationCategories.map((cat, index) => `
              <div class="assim-slot">
                <div style="display:flex; flex-direction:column;">
                  <textarea data-aidx="${index}" style="flex:1;" placeholder="Mutações ${cat.label}...">${char.assimilations[index] || ''}</textarea>
                  <div style="padding:2px 8px 6px; text-align:right;">
                    <button type="button" class="btn btn-ghost btn-sm btn-pick-assim" data-aidx="${index}" data-cat="${cat.key}">+ ${cat.label}</button>
                  </div>
                </div>
                <div class="assim-badge-col"><span>${cat.icon}</span><span>${cat.suit}</span></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div>
          <div style="text-align:center;"><div class="ribbon-title ribbon-ochre">ESPAÇOS DE INVENTÁRIO</div></div>
          <div class="inv-grid-boxes">
            ${char.inventorySlots.map((used, index) => `<button type="button" class="inv-box ${used ? 'used' : ''}" data-sidx="${index}">${used ? '✓' : ''}</button>`).join('')}
          </div>
          <div style="text-align:right; margin-bottom:4px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btnPickItems">+ Pacotes / Itens</button>
          </div>
          <textarea id="inpInvText" class="inv-items-input" placeholder="Equipamentos...">${char.inventoryText}</textarea>
          <div style="text-align:center;"><div class="ribbon-title ribbon-ochre">ANOTAÇÕES</div></div>
          <textarea id="inpAnotacoes" class="notes-paper-box" placeholder="Anotações...">${char.notes}</textarea>
        </div>
      </div>
    `;

    this.bindBackInputs(host, activeAbilities);
  },

  bindBackInputs(host, activeAbilities = []) {
    const char = this.state;

    host.querySelectorAll('.btn-use-mutation').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ability = activeAbilities[Number(btn.dataset.abidx)];
        if (!ability) return;

        const equippedMuts = getEquippedMutations(char, this.catalogs.assimilacoes);
        const hasFreeAssimilation = equippedMuts.some(m => m.effects.some(e => e.type === 'freeAssimilation'));
        const apCost = hasFreeAssimilation ? 0 : (ability.costAp || 0);
        const dpCost = ability.costDp || 0;

        if (apCost > 0 && char.assimilationPoints < apCost) {
          alert('Pontos de Assimilação insuficientes.');
          return;
        }
        if (dpCost > 0 && char.determinationPoints < dpCost) {
          alert('Pontos de Determinação insuficientes.');
          return;
        }

        char.assimilationPoints -= apCost;
        char.determinationPoints -= dpCost;

        if (ability.heal) {
          char.damageTaken = Math.max(0, char.damageTaken - ability.heal);
        } else if (ability.healFull) {
          char.damageTaken = 0;
        } else if (ability.healFormula === 'pot+res') {
          const { instincts } = getEffectiveAptitudes(char, this.catalogs.assimilacoes);
          char.damageTaken = Math.max(0, char.damageTaken - (instincts[2] + instincts[4]));
        }

        this.saveState();
        this.refreshApplicableTraits();

        if (this.transport) {
          await this.transport.sendRoll({
            system: this.id,
            player: char.name || 'Infectado(a)',
            testLabel: `Mutação Ativada: ${ability.mutName} (${ability.label})`,
            dice: [],
            totals: { A: 0, B: 0, C: 0 }
          });
        }
      });
    });

    host.querySelectorAll('.trait-name-box').forEach(input => {
      input.addEventListener('input', () => {
        const index = Number(input.dataset.tidx);
        char.traits[index].name = input.value;
        char.traits[index].effect = null;
        this.saveState();
        this.refreshApplicableTraits();
      });
    });

    host.querySelectorAll('.trait-desc-lines').forEach(textarea => {
      textarea.addEventListener('input', () => {
        char.traits[Number(textarea.dataset.tidx)].desc = textarea.value;
        this.saveState();
      });
    });

    host.querySelectorAll('.btn-pick-trait').forEach(button => {
      button.addEventListener('click', () => openTraitModal(this, Number(button.dataset.tidx)));
    });

    host.querySelectorAll('.btn-clear-trait').forEach(button => {
      button.addEventListener('click', () => {
        char.traits[Number(button.dataset.tidx)] = { name: '', desc: '', effect: null };
        this.saveState();
        this.renderBackPage(host);
        this.refreshApplicableTraits();
      });
    });

    host.querySelectorAll('.assim-slot textarea').forEach(textarea => {
      textarea.addEventListener('input', () => {
        char.assimilations[Number(textarea.dataset.aidx)] = textarea.value;
        this.saveState();
        this.refreshApplicableTraits();
      });
    });

    host.querySelectorAll('.btn-pick-assim').forEach(button => {
      button.addEventListener('click', () => openAssimilationModal(this, Number(button.dataset.aidx), button.dataset.cat));
    });

    host.querySelectorAll('.inv-box').forEach(box => {
      box.addEventListener('click', () => {
        const index = Number(box.dataset.sidx);
        char.inventorySlots[index] = !char.inventorySlots[index];
        this.saveState();
        this.renderBackPage(host);
      });
    });

    host.querySelector('#btnPickItems')?.addEventListener('click', () => openItemsModal(this));
    host.querySelector('#inpInvText')?.addEventListener('input', (event) => {
      char.inventoryText = event.target.value;
      this.saveState();
    });
    host.querySelector('#inpAnotacoes')?.addEventListener('input', (event) => {
      char.notes = event.target.value;
      this.saveState();
    });
  },

  // Filtra Características e Mutações aplicáveis ao teste atual
  getApplicableTraits() {
    const primaryInstinct = SYSTEM_DATA.instincts[Number(document.getElementById('rollIns1')?.value || 0)];
    const isInstinctAction = document.getElementById('chkInstinto')?.checked;
    const secondaryInstinct = isInstinctAction
      ? SYSTEM_DATA.instincts[Number(document.getElementById('rollIns2')?.value || 0)]
      : null;

    let selectedSkill = null;
    let skillGroup = null;
    if (!isInstinctAction) {
      const [group, idx] = (document.getElementById('rollSkill')?.value || 'c-0').split('-');
      skillGroup = group === 'c' ? 'knowledges' : 'practices';
      selectedSkill = group === 'c'
        ? SYSTEM_DATA.knowledges[Number(idx)]
        : SYSTEM_DATA.practices[Number(idx)];
    }

    const matchesCondition = (when) =>
      when === 'always' ||
      when === `ins:${primaryInstinct}` ||
      (secondaryInstinct && when === `ins:${secondaryInstinct}`) ||
      (selectedSkill && when === `skill:${selectedSkill}`) ||
      (skillGroup && when === `group:${skillGroup}`);

    const catalog = this.getAllTraits();
    const traitBonuses = this.state.traits
      .map((slot, slotIdx) => {
        if (!slot.name) return null;
        const matched = slot.effect
          ? slot
          : catalog.find(trait => trait.name.toLowerCase() === slot.name.trim().toLowerCase());

        if (!matched?.effect || !matchesCondition(matched.effect.when)) return null;
        return {
          slotIdx: `trait-${slotIdx}`,
          source: 'trait',
          name: slot.name,
          optional: Boolean(matched.effect.optional),
          effect: matched.effect
        };
      })
      .filter(Boolean);

    const skippedTypes = new Set(['aptitudeMod', 'aptitudeZero', 'healthMod', 'activeAction', 'freeInstinctAction', 'freeAssimilation', 'reroll']);
    const mutationBonuses = getEquippedMutations(this.state, this.catalogs.assimilacoes).flatMap(mut =>
      mut.effects
        .filter(eff => !skippedTypes.has(eff.type) && matchesCondition(eff.when))
        .map((eff, effIdx) => ({
          slotIdx: `${mut.id}-${effIdx}`,
          source: 'assimilation',
          name: mut.name,
          optional: Boolean(eff.optional),
          effect: eff
        }))
    );

    return [...traitBonuses, ...mutationBonuses];
  },

  refreshApplicableTraits() {
    const bar = document.getElementById('activeTraitsBar');
    if (!bar) return;

    const applicable = this.getApplicableTraits();
    if (!applicable.length) {
      bar.innerHTML = '';
      return;
    }

    const pills = applicable.map(item => {
      const isMutation = item.source === 'assimilation';
      const bg = isMutation ? '#dce8ec' : '#ede6d6';
      const border = isMutation ? 'var(--col-ass)' : 'var(--col-instinto)';
      const checkedAttr = item.optional ? '' : 'checked';
      return `
        <label style="display:inline-flex; align-items:center; gap:5px; background:${bg}; border:1px solid ${border}; padding:2px 8px; border-radius:99px; font-size:0.8rem; cursor:pointer;">
          <input type="checkbox" class="chk-trait-bonus" data-slot="${item.slotIdx}" ${checkedAttr} />
          <strong>${item.name}</strong> <span class="muted">(${item.effect.label})</span>
        </label>
      `;
    }).join('');

    bar.innerHTML = `<span class="muted" style="font-weight:600;">Modificadores:</span>${pills}`;
  },

  refreshOriginSelect() {
    const char = this.state;
    const select = document.getElementById('rollOrigem');
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = `
      <option value="">Nenhuma</option>
      <option value="evento" ${char.eventUsed ? 'disabled' : ''}>Evento: ${char.definingEvent || '—'}</option>
      <option value="ocupacao" ${char.occupationUsed ? 'disabled' : ''}>Ocupação: ${char.occupation || '—'}</option>
    `;

    const stillAvailable = previousValue && !select.querySelector(`option[value="${previousValue}"]`)?.disabled;
    select.value = stillAvailable ? previousValue : '';
  },

  executeRoll() {
    if (this.pendingRoll) return;

    const char = this.state;
    const noteEl = document.getElementById('rollNote');
    noteEl.textContent = '';

    const equippedMuts = getEquippedMutations(char, this.catalogs.assimilacoes);
    const hasFreeAssimilation = equippedMuts.some(m => m.effects.some(e => e.type === 'freeAssimilation'));
    const hasFreeInstinct = equippedMuts.some(m => m.effects.some(e => e.type === 'freeInstinctAction'));

    const applicableTraits = this.getApplicableTraits();
    const activeTraits = [...document.querySelectorAll('.chk-trait-bonus:checked')]
      .map(checkbox => applicableTraits.find(item => String(item.slotIdx) === checkbox.dataset.slot))
      .filter(Boolean);

    const ignoreHealth = activeTraits.some(t => t.effect.type === 'ignoreHealthPenalty');
    const useAssimAsInstinct = activeTraits.some(t => t.effect.type === 'useAssimAsInstinct');

    const { instincts: effectiveInstincts, knowledges: effectiveKnowledges, practices: effectivePractices } = getEffectiveAptitudes(char, this.catalogs.assimilacoes);
    const healthStatus = getHealthPenalty(char, this.catalogs.assimilacoes, ignoreHealth);

    const primaryIdx = Number(document.getElementById('rollIns1').value);
    const isInstinctAction = document.getElementById('chkInstinto').checked;
    const useEffort = document.getElementById('chkEmpenho').checked;
    const selectedOrigin = document.getElementById('rollOrigem').value;

    const spentResources = { assimilation: 0, determination: 0, origin: '' };
    const dicePool = [];
    const dieReplacements = [];
    const modifiers = {
      A: 0, B: 0, C: 0, ignoreC: 0, bToA: 0, cToB: 0, extraDice: 0,
      perKeptDieA: 0, perKeptDieB: 0, discernimentoB: 0,
      doubleA: false, halveA: false, aToCIfTwo: false
    };
    let keepCount = 1;
    let testLabel = '';

    // 1. Calcula custo de pontos das mutações ativadas no rolador
    let extraApCost = healthStatus.extraAssimilationCost;
    let extraDpCost = 0;
    activeTraits.forEach(({ effect }) => {
      if (effect.costAp) extraApCost += effect.costAp;
      if (effect.costDp) extraDpCost += effect.costDp;
    });
    if (hasFreeAssimilation) extraApCost = 0;

    if (char.assimilationPoints < extraApCost) {
      noteEl.textContent = `Pontos de Assimilação insuficientes (exige ${extraApCost}).`;
      return;
    }
    if (char.determinationPoints < extraDpCost) {
      noteEl.textContent = `Pontos de Determinação insuficientes (exige ${extraDpCost}).`;
      return;
    }
    char.assimilationPoints -= extraApCost;
    char.determinationPoints -= extraDpCost;
    spentResources.assimilation += extraApCost;
    spentResources.determination += extraDpCost;

    // 2. Acumula efeitos dos modificadores selecionados
    activeTraits.forEach(({ effect }) => {
      if (effect.type === 'addA') modifiers.A += effect.value;
      if (effect.type === 'addB') modifiers.B += effect.value;
      if (effect.type === 'addC') modifiers.C += effect.value;
      if (effect.type === 'bToA') modifiers.bToA += effect.value;
      if (effect.type === 'ignoreC') modifiers.ignoreC += effect.value;
      if (effect.type === 'cToB') modifiers.cToB += effect.value;
      if (effect.type === 'extraDie') modifiers.extraDice += effect.value;
      if (effect.type === 'extraKeep') keepCount += effect.value;
      if (effect.type === 'replaceDie') dieReplacements.push(effect);
      if (effect.type === 'perKeptDieA') modifiers.perKeptDieA += effect.value;
      if (effect.type === 'perKeptDieB') modifiers.perKeptDieB += effect.value;
      if (effect.type === 'discernimentoB') modifiers.discernimentoB += effect.value;
      if (effect.type === 'doubleA') modifiers.doubleA = true;
      if (effect.type === 'halveA') modifiers.halveA = true;
      if (effect.type === 'aToCIfTwo') modifiers.aToCIfTwo = true;
    });

    const assimilationLevel = 10 - char.determinationLevel;
    const primaryDiceCount = useAssimAsInstinct ? assimilationLevel : effectiveInstincts[primaryIdx];

    if (isInstinctAction) {
      const secondaryIdx = Number(document.getElementById('rollIns2').value);
      if (!hasFreeInstinct && !hasFreeAssimilation) {
        if (char.assimilationPoints >= 1) {
          char.assimilationPoints -= 1;
          spentResources.assimilation += 1;
        } else if (char.determinationPoints >= 2) {
          char.determinationPoints -= 2;
          spentResources.determination += 2;
        } else {
          char.assimilationPoints += spentResources.assimilation;
          char.determinationPoints += spentResources.determination;
          noteEl.textContent = 'Sem pontos para Agir por Instinto.';
          return;
        }
      }

      const secondaryDiceCount = useAssimAsInstinct ? assimilationLevel : effectiveInstincts[secondaryIdx];
      const totalDice = primaryDiceCount + secondaryDiceCount + modifiers.extraDice;
      for (let count = 0; count < totalDice; count++) dicePool.push(12);
      keepCount += 1;
      testLabel = `${SYSTEM_DATA.instincts[primaryIdx]} + ${SYSTEM_DATA.instincts[secondaryIdx]} (Por Instinto)`;
    } else {
      const [group, skillIdx] = document.getElementById('rollSkill').value.split('-');
      const skillRank = group === 'c' ? effectiveKnowledges[Number(skillIdx)] : effectivePractices[Number(skillIdx)];
      const skillName = group === 'c' ? SYSTEM_DATA.knowledges[Number(skillIdx)] : SYSTEM_DATA.practices[Number(skillIdx)];

      for (let count = 0; count < primaryDiceCount; count++) dicePool.push(6);
      for (let count = 0; count < skillRank + modifiers.extraDice; count++) dicePool.push(10);
      testLabel = `${SYSTEM_DATA.instincts[primaryIdx]} + ${skillName}`;
    }

    if (useEffort) {
      if (char.determinationPoints < 1) {
        char.assimilationPoints += spentResources.assimilation;
        char.determinationPoints += spentResources.determination;
        noteEl.textContent = 'Sem Determinação.';
        return;
      }
      char.determinationPoints -= 1;
      spentResources.determination += 1;
      keepCount += 1;
      testLabel += ' • Empenho';
    }

    if (selectedOrigin === 'evento') {
      char.eventUsed = true;
      keepCount += 1;
      testLabel += ' • Evento';
    } else if (selectedOrigin === 'ocupacao') {
      char.occupationUsed = true;
      keepCount += 1;
      testLabel += ' • Ocupação';
    }

    if (activeTraits.length) {
      testLabel += ` [${activeTraits.map(item => item.name).join(', ')}]`;
    }

    // 3. Aplica substituições de tipo de dado (Celeridade, Intuitivo, Camuflagem, Combalido)
    dieReplacements.forEach(({ from, to, all }) => {
      let replacedCount = 0;
      for (let idx = 0; idx < dicePool.length; idx++) {
        if (dicePool[idx] === from) {
          dicePool[idx] = to;
          replacedCount++;
          if (!all && replacedCount >= 1) break;
        }
      }
    });

    // 4. Aplica penalidade de Saúde
    if (healthStatus.dicePenalty > 0) {
      dicePool.splice(0, healthStatus.dicePenalty);
      testLabel += ` • Saúde (-${healthStatus.dicePenalty}d)`;

      if (!dicePool.length) {
        char.assimilationPoints += spentResources.assimilation;
        char.determinationPoints += spentResources.determination;
        noteEl.textContent = 'Sem dados restantes após penalidade de Saúde.';
        return;
      }
    }

    const rolledDice = dicePool.map(sides => ({
      sides,
      symbols: SYSTEM_DATA.dieFaces[sides][Math.floor(Math.random() * sides)]
    }));

    const rankDie = die =>
      countSymbol(die.symbols, 'A') * 100 +
      countSymbol(die.symbols, 'B') * 10 -
      countSymbol(die.symbols, 'C') * 30;

    const bestIndices = rolledDice
      .map((_, index) => index)
      .sort((a, b) => rankDie(rolledDice[b]) - rankDie(rolledDice[a]));

    this.pendingRoll = {
      label: testLabel,
      dice: rolledDice,
      keepCount: Math.min(keepCount, rolledDice.length),
      selected: new Set(bestIndices.slice(0, keepCount)),
      modifiers,
      rerolled: false
    };

    this.saveState();
    this.refreshFrontUI();
    this.refreshOriginSelect();
    this.renderPendingDice();
  },

  // Rerrolagem via Pulso Sombrio (Furtividade) ou Pulso Mental (Conhecimentos)
  rerollPendingDice() {
    if (!this.pendingRoll || this.pendingRoll.rerolled) return;
    const char = this.state;
    const equippedMuts = getEquippedMutations(char, this.catalogs.assimilacoes);
    const hasFreeAssimilation = equippedMuts.some(m => m.effects.some(e => e.type === 'freeAssimilation'));
    const cost = hasFreeAssimilation ? 0 : 1;

    if (char.assimilationPoints < cost) {
      document.getElementById('rollNote').textContent = 'Sem Assimilação para rerrolar.';
      return;
    }

    char.assimilationPoints -= cost;
    this.pendingRoll.rerolled = true;
    this.pendingRoll.label += ' • Rerrolado';
    this.pendingRoll.dice = this.pendingRoll.dice.map(die => ({
      sides: die.sides,
      symbols: SYSTEM_DATA.dieFaces[die.sides][Math.floor(Math.random() * die.sides)]
    }));

    this.saveState();
    this.refreshFrontUI();
    this.renderPendingDice();
  },

  canRerollCurrentTest() {
    const isInstinctAction = document.getElementById('chkInstinto')?.checked;
    if (isInstinctAction) return false;
    const [group, idx] = (document.getElementById('rollSkill')?.value || 'c-0').split('-');
    const skillName = group === 'c' ? SYSTEM_DATA.knowledges[Number(idx)] : SYSTEM_DATA.practices[Number(idx)];
    const skillGroup = group === 'c' ? 'knowledges' : 'practices';

    return getEquippedMutations(this.state, this.catalogs.assimilacoes).some(mut =>
      mut.effects.some(eff =>
        eff.type === 'reroll' && (eff.when === `skill:${skillName}` || eff.when === `group:${skillGroup}`)
      )
    );
  },

  renderPendingDice() {
    const tray = document.getElementById('diceTray');
    const preview = document.getElementById('rollTotalPreview');
    const confirmBtn = document.getElementById('btnConfirmRoll');
    const rollBtn = document.getElementById('btnRoll');
    const rerollBtn = document.getElementById('btnReroll');
    tray.innerHTML = '';

    if (!this.pendingRoll) {
      preview.innerHTML = '';
      confirmBtn.disabled = true;
      rollBtn.disabled = false;
      rerollBtn.style.display = 'none';
      return;
    }

    rollBtn.disabled = true;
    rerollBtn.style.display = !this.pendingRoll.rerolled && this.canRerollCurrentTest() ? 'inline-block' : 'none';
    const { dice, keepCount, selected } = this.pendingRoll;

    dice.forEach((die, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `die-btn ${selected.has(index) ? 'kept' : ''}`;
      button.innerHTML = `<span class="die-type">d${die.sides}</span>${formatSymbolsHTML(die.symbols, false)}`;

      button.addEventListener('click', () => {
        if (selected.has(index)) {
          selected.delete(index);
        } else {
          selected.add(index);
          if (selected.size > keepCount) {
            const oldestSelection = selected.values().next().value;
            selected.delete(oldestSelection);
          }
        }
        this.renderPendingDice();
      });

      tray.appendChild(button);
    });

    const totals = calculateRollTotals(this.pendingRoll);
    preview.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:10px;">
        <strong>Mantidos (${selected.size}/${keepCount}):</strong>
        <span class="sym-badge sym-A">${totals.A} ${getSymbolIcon('A', true)}</span>
        <span class="sym-badge sym-B">${totals.B} ${getSymbolIcon('B', true)}</span>
        <span class="sym-badge sym-C">${totals.C} ${getSymbolIcon('C', true)}</span>
      </span>
    `;
    confirmBtn.disabled = selected.size === 0;
  },

  async confirmRoll() {
    if (!this.pendingRoll) return;
    const { label, dice, selected } = this.pendingRoll;

    await this.transport.sendRoll({
      system: this.id,
      player: this.state.name || 'Infectado(a)',
      testLabel: label,
      dice: dice.map((die, index) => ({
        sides: die.sides,
        symbols: die.symbols,
        kept: selected.has(index)
      })),
      totals: calculateRollTotals(this.pendingRoll)
    });

    this.pendingRoll = null;
    this.renderPendingDice();
  }
};
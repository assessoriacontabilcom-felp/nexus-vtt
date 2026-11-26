import { SYSTEM_DATA, getSymbolIcon } from './rules.js';

const EFFECT_LABELS = {
  addA: '+1 Joaninha',
  addB: '+1 Cervo',
  bToA: '1 Cervo → 1 Joaninha',
  ignoreC: 'Ignora 1 Coruja',
  cToB: '1 Coruja → 1 Cervo',
  extraDie: '+1 dado',
  extraKeep: 'Mantém +1 dado'
};

// Cria o fundo escuro padrão dos modais e fecha ao clicar fora ou no botão Fechar
function createModalBackdrop(contentHTML) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-box">${contentHTML}</div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#closeModal')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  return { backdrop, close };
}

// Substitui sequências isoladas de A, B e C nos custos das mutações pelos ícones SVG
function renderCostIcons(costText) {
  if (!costText) return '';
  return costText.replace(/\b([ABC]+)\b/g, (symbols) => {
    const icons = symbols.split('').map(char => getSymbolIcon(char, true)).join('');
    return `<span style="display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">${icons}</span>`;
  });
}

// Modal de Características: busca no catálogo oficial + criação de característica customizada
export function openTraitModal(sheetModule, slotIndex) {
  const instinctOptions = SYSTEM_DATA.instincts
    .map(name => `<option value="ins:${name}">Instinto: ${name}</option>`)
    .join('');
  const skillOptions = [...SYSTEM_DATA.knowledges, ...SYSTEM_DATA.practices]
    .map(name => `<option value="skill:${name}">Perícia: ${name}</option>`)
    .join('');

  const { backdrop, close } = createModalBackdrop(`
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--paper-line); padding-bottom:8px; margin-bottom:10px;">
      <h3 style="font-family:var(--font-display); color:var(--col-instinto); font-size:1rem;">Características (Slot ${slotIndex + 1})</h3>
      <button type="button" class="btn btn-ghost btn-sm" id="closeModal">Fechar</button>
    </div>
    <input type="text" id="traitSearchInp" style="width:100%; background:#fff; color:var(--ink-dark);" placeholder="Buscar por nome, requisito ou efeito..." />
    <div class="trait-catalog-list" id="traitCatalogList"></div>
    <div style="border-top:1px solid var(--paper-line); padding-top:10px; margin-top:8px;">
      <strong style="font-size:0.82rem; color:var(--ink-muted); display:block; margin-bottom:6px;">Criar Característica personalizada:</strong>
      <input type="text" id="newTraitName" style="width:100%; background:#fff; color:var(--ink-dark); margin-bottom:6px;" placeholder="Nome..." />
      <textarea id="newTraitDesc" style="width:100%; min-height:48px; background:#fff; color:var(--ink-dark); border:1px solid var(--paper-line); border-radius:4px; padding:6px; font-family:var(--font-hand); margin-bottom:6px;" placeholder="Descrição mecânica..."></textarea>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
        <select id="newTraitWhen" style="background:#fff; color:var(--ink-dark); padding:4px; border:1px solid var(--paper-line); border-radius:4px;">
          <option value="">Sem bônus automático</option>
          <option value="always">Em qualquer teste</option>
          <optgroup label="Instintos">${instinctOptions}</optgroup>
          <optgroup label="Perícias">${skillOptions}</optgroup>
        </select>
        <select id="newTraitType" style="background:#fff; color:var(--ink-dark); padding:4px; border:1px solid var(--paper-line); border-radius:4px;">
          <option value="addA">+1 Sucesso (Joaninha)</option>
          <option value="addB">+1 Adaptação (Cervo)</option>
          <option value="bToA">Converte 1 Cervo → 1 Joaninha</option>
          <option value="ignoreC">Ignora 1 Pressão (Coruja)</option>
          <option value="cToB">Converte 1 Coruja → 1 Cervo</option>
          <option value="extraDie">+1 Dado extra na rolagem</option>
          <option value="extraKeep">Mantém +1 dado extra</option>
        </select>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="btnSaveNewTrait">Salvar & Aplicar</button>
    </div>
  `);

  const listEl = backdrop.querySelector('#traitCatalogList');
  const searchEl = backdrop.querySelector('#traitSearchInp');

  const renderTraits = (query = '') => {
    const term = query.toLowerCase().trim();
    const matches = sheetModule.getAllTraits().filter(trait =>
      trait.name.toLowerCase().includes(term) ||
      trait.desc.toLowerCase().includes(term) ||
      (trait.req && trait.req.toLowerCase().includes(term))
    );

    if (!matches.length) {
      listEl.innerHTML = '<div class="muted">Nenhuma característica encontrada.</div>';
      return;
    }

    listEl.innerHTML = matches.map((trait, index) => `
      <button type="button" class="catalog-item" data-idx="${index}">
        <strong>${trait.name} ${trait.cost ? `(${trait.cost} XP)` : ''} ${trait.effect ? '⚡' : ''}</strong>
        ${trait.req ? `<div style="font-size:0.74rem; color:var(--col-pericia); font-weight:600;">Req: ${trait.req}</div>` : ''}
        <span>${trait.desc}</span>
      </button>
    `).join('');

    listEl.querySelectorAll('.catalog-item').forEach((button, index) => {
      button.addEventListener('click', () => {
        const selected = matches[index];
        sheetModule.state.traits[slotIndex] = {
          name: selected.name,
          desc: selected.desc,
          effect: selected.effect || null
        };
        sheetModule.saveState();
        close();
        sheetModule.renderActiveSheetPage();
        sheetModule.refreshApplicableTraits();
      });
    });
  };

  renderTraits();
  searchEl.addEventListener('input', () => renderTraits(searchEl.value));
  searchEl.focus();

  backdrop.querySelector('#btnSaveNewTrait')?.addEventListener('click', () => {
    const name = backdrop.querySelector('#newTraitName').value.trim();
    const desc = backdrop.querySelector('#newTraitDesc').value.trim();
    const when = backdrop.querySelector('#newTraitWhen').value;
    const type = backdrop.querySelector('#newTraitType').value;
    if (!name) return;

    const cleanTarget = when.replace(/^.*:/, '');
    const effect = when ? { when, type, value: 1, label: `${EFFECT_LABELS[type]} (${cleanTarget})` } : null;
    const createdTrait = { name, desc, effect };

    sheetModule.customTraits.unshift(createdTrait);
    sheetModule.saveCustomTraits();
    sheetModule.state.traits[slotIndex] = createdTrait;
    sheetModule.saveState();

    close();
    sheetModule.renderActiveSheetPage();
    sheetModule.refreshApplicableTraits();
  });
}

// Modal das 52 cartas de Assimilação filtradas por naipe e nível atual de Assimilação
export function openAssimilationModal(sheetModule, slotIndex, categoryKey) {
  const cards = sheetModule.catalogs.assimilacoes[categoryKey] || [];
  const currentAssimLevel = 10 - sheetModule.state.determinationLevel;

  const getMinAssimLevel = (costText) => {
    const match = String(costText || '').match(/assim\.?\s*(\d+)\+/i);
    return match ? Number(match[1]) : 0;
  };

  const { backdrop, close } = createModalBackdrop(`
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--paper-line); padding-bottom:8px; margin-bottom:10px;">
      <div>
        <h3 style="font-family:var(--font-display); color:var(--col-ass); font-size:1rem; margin:0;">
          Assimilações (${categoryKey.toUpperCase()})
        </h3>
        <span style="font-size:0.76rem; color:var(--ink-muted);">
          Seu nível atual de Assimilação: <strong style="color:var(--col-ass);">${currentAssimLevel}</strong>
        </span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="closeModal">Fechar</button>
    </div>
    <input type="text" id="assimSearchInp" style="width:100%; background:#fff; color:var(--ink-dark); margin-bottom:6px;" placeholder="Buscar carta ou mutação..." />
    <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--ink-muted); margin-bottom:8px; cursor:pointer;">
      <input type="checkbox" id="chkShowLockedAssim" />
      Mostrar mutações acima do meu nível de Assimilação
    </label>
    <div class="trait-catalog-list" id="assimCatalogList" style="max-height:400px;"></div>
  `);

  const listEl = backdrop.querySelector('#assimCatalogList');
  const searchEl = backdrop.querySelector('#assimSearchInp');
  const showLockedEl = backdrop.querySelector('#chkShowLockedAssim');

  const renderCards = () => {
    const term = searchEl.value.toLowerCase().trim();
    const showLocked = showLockedEl.checked;

    const filteredCards = cards
      .map(card => {
        const visibleMutations = (card.mutations || []).filter(mut => {
          const minLevel = getMinAssimLevel(mut.cost);
          if (!showLocked && minLevel > currentAssimLevel) return false;
          if (!term) return true;
          return (
            card.title.toLowerCase().includes(term) ||
            card.card.toLowerCase().includes(term) ||
            mut.name.toLowerCase().includes(term) ||
            (mut.desc && mut.desc.toLowerCase().includes(term))
          );
        });

        return { ...card, visibleMutations };
      })
      .filter(card => card.visibleMutations.length > 0);

    if (!filteredCards.length) {
      listEl.innerHTML = `<div class="muted">Nenhuma mutação disponível para Assimilação ${currentAssimLevel} com esse filtro.</div>`;
      return;
    }

    listEl.innerHTML = filteredCards.map(card => `
      <div class="catalog-item" style="border-left-color:var(--col-ass); cursor:default;">
        <strong style="color:var(--col-ass); font-size:1rem; margin-bottom:4px;">${card.card} — ${card.title}</strong>
        ${card.visibleMutations.map(mut => {
          const minLevel = getMinAssimLevel(mut.cost);
          const isLocked = minLevel > currentAssimLevel;
          return `
            <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--paper-line); display:flex; justify-content:space-between; align-items:center; gap:10px; opacity:${isLocked ? '0.6' : '1'};">
              <div>
                <div style="font-weight:700; color:var(--col-instinto); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  ${renderCostIcons(mut.cost)}
                  <span>— ${mut.name}: ${mut.effects?.length ? '⚡' : ''}</span>
                </div>
                <span style="display:block; margin-top:2px;">${mut.desc || ''}</span>
              </div>
              ${isLocked
                ? `<span style="flex-shrink:0; font-size:0.75rem; font-weight:700; color:#8c2318; background:#f8d7da; padding:4px 8px; border-radius:4px;">Requer Assim. ${minLevel}+</span>`
                : `<button type="button" class="btn btn-ghost btn-sm btn-add-mut" style="flex-shrink:0;" data-text="${mut.name} (${mut.cost}): ${mut.desc || card.title}">+ Adicionar</button>`
              }
            </div>
          `;
        }).join('')}
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-add-mut').forEach(button => {
      button.addEventListener('click', () => {
        const current = sheetModule.state.assimilations[slotIndex];
        sheetModule.state.assimilations[slotIndex] = current
          ? `${current}\n${button.dataset.text}`
          : button.dataset.text;
        sheetModule.saveState();
        close();
        sheetModule.renderActiveSheetPage();
        sheetModule.refreshApplicableTraits();
      });
    });
  };

  renderCards();
  searchEl.addEventListener('input', renderCards);
  showLockedEl.addEventListener('change', renderCards);
  searchEl.focus();
}

// Modal de Pacotes Iniciais, Artefatos e Equipamentos Comuns
export function openItemsModal(sheetModule) {
  const { pacotesIniciais = [], equipamentos = [], artefatos = [] } = sheetModule.catalogs.itens;
  const { backdrop, close } = createModalBackdrop(`
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--paper-line); padding-bottom:8px; margin-bottom:10px;">
      <h3 style="font-family:var(--font-display); color:var(--col-pericia); font-size:1rem;">Equipamentos, Pacotes & Artefatos</h3>
      <button type="button" class="btn btn-ghost btn-sm" id="closeModal">Fechar</button>
    </div>
    <input type="text" id="itemSearchInp" style="width:100%; background:#fff; color:var(--ink-dark);" placeholder="Buscar pacote, artefato ou equipamento..." />
    <div class="trait-catalog-list" id="itemCatalogList" style="max-height:400px;"></div>
  `);

  const listEl = backdrop.querySelector('#itemCatalogList');
  const searchEl = backdrop.querySelector('#itemSearchInp');

  const renderItems = (query = '') => {
    const term = query.toLowerCase().trim();
    const packs = pacotesIniciais.filter(pack =>
      pack.name.toLowerCase().includes(term) || pack.items.join(', ').toLowerCase().includes(term)
    );
    const artifacts = artefatos.filter(art =>
      art.name.toLowerCase().includes(term) || art.desc.toLowerCase().includes(term)
    );
    const gear = equipamentos.filter(item =>
      item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term)
    );

    listEl.innerHTML = `
      ${packs.length ? '<strong style="color:var(--col-instinto); font-size:0.85rem;">PACOTES INICIAIS</strong>' : ''}
      ${packs.map(pack => `<button type="button" class="catalog-item btn-add-item" data-item="${pack.name}: ${pack.items.join(', ')}"><strong>${pack.name}</strong><span>${pack.items.join(', ')}</span></button>`).join('')}

      ${artifacts.length ? '<strong style="color:var(--col-ass); font-size:0.85rem; margin-top:8px;">ARTEFATOS</strong>' : ''}
      ${artifacts.map(art => `<button type="button" class="catalog-item btn-add-item" style="border-left-color:var(--col-ass);" data-item="${art.name} (Escassez ${art.scarcity}) — ${art.desc}"><strong style="color:var(--col-ass);">${art.name} (Escassez ${art.scarcity} · ${art.slots} espaço)</strong><span>${art.desc}</span></button>`).join('')}

      ${gear.length ? '<strong style="color:var(--col-pericia); font-size:0.85rem; margin-top:8px;">EQUIPAMENTOS COMUNS</strong>' : ''}
      ${gear.map(item => `<button type="button" class="catalog-item btn-add-item" style="border-left-color:var(--col-pericia);" data-item="${item.name} (Escassez ${item.scarcity})"><strong style="color:var(--col-pericia);">${item.name} (Escassez ${item.scarcity})</strong><span>${item.desc}</span></button>`).join('')}
    `;

    listEl.querySelectorAll('.btn-add-item').forEach(button => {
      button.addEventListener('click', () => {
        const current = sheetModule.state.inventoryText;
        sheetModule.state.inventoryText = current
          ? `${current}\n• ${button.dataset.item}`
          : `• ${button.dataset.item}`;
        sheetModule.saveState();
        close();
        sheetModule.renderActiveSheetPage();
      });
    });
  };

  renderItems();
  searchEl.addEventListener('input', () => renderItems(searchEl.value));
  searchEl.focus();
}
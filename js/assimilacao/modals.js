import { CONSTANTS, getSymbolIcon } from './rules.js';

function createBackdrop(innerHTML) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-box">${innerHTML}</div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#closeModal').onclick = close;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  return { backdrop, close };
}

function formatCostIcons(costStr) {
  if (!costStr) return '';
  return costStr.replace(/\b([ABC]+)\b/g, (match) =>
    `<span style="display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">${match
      .split('')
      .map(c => getSymbolIcon(c, true))
      .join('')}</span>`
  );
}

export function openTraitModal(module, slotIndex) {
  const { backdrop, close } = createBackdrop(`
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
          <optgroup label="Instintos">${CONSTANTS.INSTINTOS.map(i => `<option value="ins:${i}">Instinto: ${i}</option>`).join('')}</optgroup>
          <optgroup label="Perícias">${[...CONSTANTS.CONHECIMENTOS, ...CONSTANTS.PRATICAS].map(s => `<option value="skill:${s}">Perícia: ${s}</option>`).join('')}</optgroup>
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

  const renderList = (filter = '') => {
    const q = filter.toLowerCase().trim();
    const filtered = module.getAllTraits().filter(t =>
      t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || (t.req && t.req.toLowerCase().includes(q))
    );

    listEl.innerHTML = filtered.length
      ? filtered.map((t, i) => `
          <button type="button" class="catalog-item" data-idx="${i}">
            <strong>${t.name} ${t.cost ? `(${t.cost} XP)` : ''} ${t.effect ? '⚡' : ''}</strong>
            ${t.req ? `<div style="font-size:0.74rem; color:var(--col-pericia); font-weight:600;">Req: ${t.req}</div>` : ''}
            <span>${t.desc}</span>
          </button>
        `).join('')
      : '<div class="muted">Nenhuma característica encontrada.</div>';

    listEl.querySelectorAll('.catalog-item').forEach((btn, idx) => {
      btn.onclick = () => {
        const chosen = filtered[idx];
        module.state.caracteristicas[slotIndex] = { name: chosen.name, desc: chosen.desc, effect: chosen.effect || null };
        module.saveState();
        close();
        module.renderActiveSheetPage();
        module.refreshApplicableTraits();
      };
    });
  };

  renderList();
  searchEl.addEventListener('input', () => renderList(searchEl.value));
  searchEl.focus();

  backdrop.querySelector('#btnSaveNewTrait').onclick = () => {
    const name = backdrop.querySelector('#newTraitName').value.trim();
    const desc = backdrop.querySelector('#newTraitDesc').value.trim();
    const when = backdrop.querySelector('#newTraitWhen').value;
    const type = backdrop.querySelector('#newTraitType').value;
    if (!name) return;

    const labels = { addA: '+1 Joaninha', addB: '+1 Cervo', bToA: '1 Cervo → 1 Joaninha', ignoreC: 'Ignora 1 Coruja', cToB: '1 Coruja → 1 Cervo', extraDie: '+1 dado', extraKeep: 'Mantém +1 dado' };
    const effect = when ? { when, type, value: 1, label: `${labels[type]} (${when.replace(/^.*:/, '')})` } : null;

    const newObj = { name, desc, effect };
    module.customTraits.unshift(newObj);
    module.saveCustomTraits();
    module.state.caracteristicas[slotIndex] = newObj;
    module.saveState();
    close();
    module.renderActiveSheetPage();
    module.refreshApplicableTraits();
  };
}

export function openAssimilationModal(module, slotIdx, categoryKey) {
  const list = module.catalogs.assimilacoes[categoryKey] || [];
  const { backdrop, close } = createBackdrop(`
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--paper-line); padding-bottom:8px; margin-bottom:10px;">
      <h3 style="font-family:var(--font-display); color:var(--col-ass); font-size:1rem;">Assimilações (${categoryKey.toUpperCase()})</h3>
      <button type="button" class="btn btn-ghost btn-sm" id="closeModal">Fechar</button>
    </div>
    <input type="text" id="assimSearchInp" style="width:100%; background:#fff; color:var(--ink-dark);" placeholder="Buscar carta ou mutação..." />
    <div class="trait-catalog-list" id="assimCatalogList" style="max-height:400px;"></div>
  `);

  const listEl = backdrop.querySelector('#assimCatalogList');
  const searchEl = backdrop.querySelector('#assimSearchInp');

  const renderList = (filter = '') => {
    const q = filter.toLowerCase().trim();
    const filtered = list.filter(card =>
      card.title.toLowerCase().includes(q) ||
      card.card.toLowerCase().includes(q) ||
      (card.mutations || []).some(m => m.name.toLowerCase().includes(q) || (m.desc && m.desc.toLowerCase().includes(q)))
    );

    listEl.innerHTML = filtered.length
      ? filtered.map(card => `
          <div class="catalog-item" style="border-left-color:var(--col-ass); cursor:default;">
            <strong style="color:var(--col-ass); font-size:1rem; margin-bottom:4px;">${card.card} — ${card.title}</strong>
            ${(card.mutations || []).map(m => `
              <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--paper-line); display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <div style="font-weight:700; color:var(--col-instinto); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${formatCostIcons(m.cost)}
                    <span>— ${m.name}:</span>
                  </div>
                  <span style="display:block; margin-top:2px;">${m.desc || ''}</span>
                </div>
                <button type="button" class="btn btn-ghost btn-sm btn-add-mut" style="flex-shrink:0;" data-text="${m.name} (${m.cost}): ${m.desc || card.title}">+ Adicionar</button>
              </div>
            `).join('')}
          </div>
        `).join('')
      : '<div class="muted">Nenhuma mutação encontrada.</div>';

    listEl.querySelectorAll('.btn-add-mut').forEach(btn => {
      btn.onclick = () => {
        const cur = module.state.assimilacoes[slotIdx];
        module.state.assimilacoes[slotIdx] = cur ? `${cur}\n${btn.dataset.text}` : btn.dataset.text;
        module.saveState();
        close();
        module.renderActiveSheetPage();
      };
    });
  };

  renderList();
  searchEl.addEventListener('input', () => renderList(searchEl.value));
  searchEl.focus();
}

export function openItemsModal(module) {
  const { pacotesIniciais = [], equipamentos = [], artefatos = [] } = module.catalogs.itens;
  const { backdrop, close } = createBackdrop(`
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--paper-line); padding-bottom:8px; margin-bottom:10px;">
      <h3 style="font-family:var(--font-display); color:var(--col-pericia); font-size:1rem;">Equipamentos, Pacotes & Artefatos</h3>
      <button type="button" class="btn btn-ghost btn-sm" id="closeModal">Fechar</button>
    </div>
    <input type="text" id="itemSearchInp" style="width:100%; background:#fff; color:var(--ink-dark);" placeholder="Buscar pacote, artefato ou equipamento..." />
    <div class="trait-catalog-list" id="itemCatalogList" style="max-height:400px;"></div>
  `);

  const listEl = backdrop.querySelector('#itemCatalogList');
  const searchEl = backdrop.querySelector('#itemSearchInp');

  const renderList = (filter = '') => {
    const q = filter.toLowerCase().trim();
    const fPacotes = pacotesIniciais.filter(p => p.name.toLowerCase().includes(q) || p.items.join(', ').toLowerCase().includes(q));
    const fArtefatos = artefatos.filter(a => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
    const fEquip = equipamentos.filter(e => e.name.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q));

    listEl.innerHTML = `
      ${fPacotes.length ? `<strong style="color:var(--col-instinto); font-size:0.85rem;">PACOTES INICIAIS</strong>` : ''}
      ${fPacotes.map(p => `<button type="button" class="catalog-item btn-add-item" data-item="${p.name}: ${p.items.join(', ')}"><strong>${p.name}</strong><span>${p.items.join(', ')}</span></button>`).join('')}

      ${fArtefatos.length ? `<strong style="color:var(--col-ass); font-size:0.85rem; margin-top:8px;">ARTEFATOS</strong>` : ''}
      ${fArtefatos.map(a => `<button type="button" class="catalog-item btn-add-item" style="border-left-color:var(--col-ass);" data-item="${a.name} (Escassez ${a.scarcity}) — ${a.desc}"><strong style="color:var(--col-ass);">${a.name} (Escassez ${a.scarcity} · ${a.slots} espaço)</strong><span>${a.desc}</span></button>`).join('')}

      ${fEquip.length ? `<strong style="color:var(--col-pericia); font-size:0.85rem; margin-top:8px;">EQUIPAMENTOS COMUNS</strong>` : ''}
      ${fEquip.map(eq => `<button type="button" class="catalog-item btn-add-item" style="border-left-color:var(--col-pericia);" data-item="${eq.name} (Escassez ${eq.scarcity})"><strong style="color:var(--col-pericia);">${eq.name} (Escassez ${eq.scarcity})</strong><span>${eq.desc}</span></button>`).join('')}
    `;

    listEl.querySelectorAll('.btn-add-item').forEach(btn => {
      btn.onclick = () => {
        const cur = module.state.inventarioTexto;
        module.state.inventarioTexto = cur ? `${cur}\n• ${btn.dataset.item}` : `• ${btn.dataset.item}`;
        module.saveState();
        close();
        module.renderActiveSheetPage();
      };
    });
  };

  renderList();
  searchEl.addEventListener('input', () => renderList(searchEl.value));
  searchEl.focus();
}
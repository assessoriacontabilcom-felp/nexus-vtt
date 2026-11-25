export const CONSTANTS = {
  INSTINTOS: ['Influência', 'Percepção', 'Potência', 'Reação', 'Resolução', 'Sagacidade'],
  CONHECIMENTOS: ['Biologia', 'Erudição', 'Engenharia', 'Geografia', 'Medicina', 'Segurança'],
  PRATICAS: ['Armas', 'Atletismo', 'Expressão', 'Furtividade', 'Manufaturas', 'Sobrevivência'],
  SAUDE_NIVEIS: ['Saudável', 'Escoriação', 'Laceração', 'Ferimentos', 'Debilitação', 'Incapacitação'],
  FACES: {
    6:  ['', '', 'C', 'C', 'BC', 'A'],
    10: ['', '', 'C', 'C', 'BC', 'A', 'AA', 'AB', 'ABC', 'AAC'],
    12: ['', '', 'C', 'C', 'BC', 'A', 'AA', 'AB', 'ABC', 'AAC', 'ABBC', 'CC']
  }
};

export const SYMBOLS_SVG = {
  A: `<svg class="die-svg" viewBox="0 0 64 64" aria-label="Joaninha"><path d="M25 14l-5-7m19 7l5-7" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M17 24L7 19m10 14H4m14 10L8 51m39-27l10-5m-10 14h13m-14 10l10 8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M23 19c0-5 18-5 18 0v3H23v-3z"/><path d="M16 36c0-11 7-15 16-15s16 4 16 15c0 12-7 19-16 19s-16-7-16-19zm14.5-10v24h3V26h-3zm-7.5 2a3 2.2 0 1 0 0 4.4 3 2.2 0 1 0 0-4.4zm18 0a3 2.2 0 1 0 0 4.4 3 2.2 0 1 0 0-4.4zm-17 12a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zm16 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z" fill-rule="evenodd"/></svg>`,
  B: `<svg class="die-svg" viewBox="0 0 64 64" aria-label="Cervo"><path d="M24 27c-8-4-14-12-13-21 3 5 7 8 11 9-1-4 0-8 2-11 1 5 3 9 5 12m11 11c8-4 14-12 13-21-3 5-7 8-11 9 1-4 0-8-2-11-1 5-3 9-5 12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 28l-9-3 3 7 6 1zm20 0l9-3-3 7-6 1z"/><path d="M22 27h20l3 14-8 16H27l-8-16 3-14zm4 11l3 2-3 2-2-2zm12 0l-3 2 3 2 2-2zm-8 14h4l-2 3-2-3z" fill-rule="evenodd"/></svg>`,
  C: `<svg class="die-svg" viewBox="0 0 64 64" aria-label="Coruja"><path d="M12 11l11 7h18l11-7-2 15 6 5-6 5 4 9-9-1-5 9-7-5-7 5-5-9-9 1 4-9-6-5 6-5-2-15zm11 18c-4 0-7 3-7 6s3 5 7 5 6-2 6-5-2-6-6-6zm18 0c-4 0-6 3-6 6s2 5 6 5 7-2 7-5-3-6-7-6zm-9 11l-3 5h6l-3-5z" fill-rule="evenodd"/></svg>`,
  TREE: `<svg class="die-svg sm" viewBox="0 0 64 64" aria-label="Árvore"><path d="M32 6C18 6 10 16 12 26c-5 3-6 11 1 15h14v17h10V41h14c7-4 6-12 1-15 2-10-6-20-20-20z"/></svg>`
};

export const countSym = (str, char) => str.split(char).length - 1;

export function getSymbolIcon(char, small = false) {
  const titles = { A: 'Sucesso (Joaninha)', B: 'Adaptação (Cervo)', C: 'Pressão (Coruja)' };
  const raw = SYMBOLS_SVG[char] || '';
  const svg = small ? raw.replace('class="die-svg"', 'class="die-svg sm"') : raw;
  return `<span class="sym-${char}" title="${titles[char] || ''}">${svg}</span>`;
}

export function formatSymbolsHTML(symStr, small = false) {
  if (!symStr) return '<span class="sym-empty">vazio</span>';
  return `<span class="sym-group">${symStr.split('').map(c => getSymbolIcon(c, small)).join('')}</span>`;
}

export function getDerivedStats(state) {
  const nivelAssimilacao = 10 - state.nivelDeterminacao;
  const pvPorNivel = 1 + state.instintos[2] + state.instintos[4];
  return {
    nivelAssimilacao,
    pvPorNivel,
    pvTotal: pvPorNivel * 6,
    nivelAtualIdx: Math.floor(state.danoSofrido / pvPorNivel)
  };
}

export function computeFinalTotals(pending) {
  const keptSymbols = [...pending.selected].map(i => pending.dice[i].symbols).join('');
  let A = countSym(keptSymbols, 'A');
  let B = countSym(keptSymbols, 'B');
  let C = countSym(keptSymbols, 'C');
  const fb = pending.flatBonus || {};

  const convB = Math.min(B, fb.bToA || 0);
  B -= convB; A += convB;

  const convC = Math.min(C, fb.cToB || 0);
  C -= convC; B += convC;

  return {
    A: A + (fb.A || 0),
    B: B + (fb.B || 0),
    C: Math.max(0, C - (fb.ignoreC || 0))
  };
}
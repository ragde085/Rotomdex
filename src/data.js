/* ============================================================
   Data layer — PokéAPI helpers + Spanish translations + cache
   ============================================================ */

const API = 'https://pokeapi.co/api/v2';
const cache = new Map();
const inflight = new Map();

async function fetchJson(url) {
  if (cache.has(url)) return cache.get(url);
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url).then(r => {
    if (!r.ok) throw new Error('fetch failed: ' + url);
    return r.json();
  }).then(j => {
    cache.set(url, j);
    inflight.delete(url);
    return j;
  }).catch(e => {
    inflight.delete(url);
    throw e;
  });
  inflight.set(url, p);
  return p;
}

let _indexPromise = null;
export function loadIndex() {
  if (!_indexPromise) {
    _indexPromise = fetchJson(`${API}/pokemon?limit=1500&offset=0`)
      .then(d => d.results
        .map((r) => ({
          id: parseIdFromUrl(r.url),
          name: r.name,
          url: r.url,
        }))
        .filter(x => x.id && x.id <= 1025)
        .sort((a, b) => a.id - b.id)
      );
  }
  return _indexPromise;
}

function parseIdFromUrl(url) {
  const m = url.match(/\/pokemon\/(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
}

export async function getPokemon(idOrName) {
  return fetchJson(`${API}/pokemon/${idOrName}`);
}

export async function getSpecies(idOrName) {
  return fetchJson(`${API}/pokemon-species/${idOrName}`);
}

export async function getTypeData(typeName) {
  return fetchJson(`${API}/type/${typeName}`);
}

export async function getEvolutionChain(url) {
  return fetchJson(url);
}

export async function getAbility(name) {
  return fetchJson(`${API}/ability/${name}`);
}

export async function getMove(name) {
  return fetchJson(`${API}/move/${name}`);
}

export function getSpanishName(species) {
  const entry = species.names.find(n => n.language.name === 'es');
  return entry ? entry.name : species.name;
}

export function getSpanishFlavor(species) {
  const entries = species.flavor_text_entries.filter(e => e.language.name === 'es');
  if (entries.length === 0) {
    const en = species.flavor_text_entries.find(e => e.language.name === 'en');
    return en ? cleanFlavor(en.flavor_text) : '';
  }
  return cleanFlavor(entries[entries.length - 1].flavor_text);
}

function cleanFlavor(s) {
  return s.replace(/[\f\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getSpanishCategory(species) {
  const e = species.genera.find(g => g.language.name === 'es');
  return e ? e.genus : '';
}

export function getSpanishAbilityName(ability) {
  const e = ability.names.find(n => n.language.name === 'es');
  return e ? e.name : ability.name;
}
export function getSpanishAbilityDesc(ability) {
  const e = ability.flavor_text_entries.find(x => x.language.name === 'es');
  if (e) return cleanFlavor(e.flavor_text);
  const en = ability.flavor_text_entries.find(x => x.language.name === 'en');
  return en ? cleanFlavor(en.flavor_text) : '';
}
export function getSpanishMoveName(move) {
  const e = move.names.find(n => n.language.name === 'es');
  return e ? e.name : move.name;
}

export const TYPE_ES = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada',
};

export const STAT_ES = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defensa',
  'special-attack': 'At. Esp.',
  'special-defense': 'Def. Esp.',
  speed: 'Velocidad',
};

export const GENERATIONS = [
  { id: 1, name: 'Gen I',   range: [1, 151],    region: 'Kanto' },
  { id: 2, name: 'Gen II',  range: [152, 251],  region: 'Johto' },
  { id: 3, name: 'Gen III', range: [252, 386],  region: 'Hoenn' },
  { id: 4, name: 'Gen IV',  range: [387, 493],  region: 'Sinnoh' },
  { id: 5, name: 'Gen V',   range: [494, 649],  region: 'Teselia' },
  { id: 6, name: 'Gen VI',  range: [650, 721],  region: 'Kalos' },
  { id: 7, name: 'Gen VII', range: [722, 809],  region: 'Alola' },
  { id: 8, name: 'Gen VIII',range: [810, 905],  region: 'Galar' },
  { id: 9, name: 'Gen IX',  range: [906, 1025], region: 'Paldea' },
];

export function genFromId(id) {
  return GENERATIONS.find(g => id >= g.range[0] && id <= g.range[1]);
}

export function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
export function spriteUrlSmall(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export const spanishNameIndex = new Map();
export async function ensureSpanishName(id) {
  if (spanishNameIndex.has(id)) return spanishNameIndex.get(id);
  try {
    const sp = await getSpecies(id);
    const nm = getSpanishName(sp).toLowerCase();
    spanishNameIndex.set(id, nm);
    return nm;
  } catch (e) {
    return null;
  }
}

const TYPE_CHART = {
  normal:   { fighting: 2, ghost: 0 },
  fire:     { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5, fairy: 0.5 },
  water:    { electric: 2, grass: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  electric: { ground: 2, electric: 0.5, flying: 0.5, steel: 0.5 },
  grass:    { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: 0.5, electric: 0.5, grass: 0.5, ground: 0.5 },
  ice:      { fire: 2, fighting: 2, rock: 2, steel: 2, ice: 0.5 },
  fighting: { flying: 2, psychic: 2, fairy: 2, bug: 0.5, rock: 0.5, dark: 0.5 },
  poison:   { ground: 2, psychic: 2, grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5, fairy: 0.5 },
  ground:   { water: 2, grass: 2, ice: 2, poison: 0.5, rock: 0.5, electric: 0 },
  flying:   { electric: 2, ice: 2, rock: 2, grass: 0.5, fighting: 0.5, bug: 0.5, ground: 0 },
  psychic:  { bug: 2, ghost: 2, dark: 2, fighting: 0.5, psychic: 0.5 },
  bug:      { fire: 2, flying: 2, rock: 2, grass: 0.5, fighting: 0.5, ground: 0.5 },
  rock:     { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
  ghost:    { ghost: 2, dark: 2, poison: 0.5, bug: 0.5, normal: 0, fighting: 0 },
  dragon:   { ice: 2, dragon: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, grass: 0.5 },
  dark:     { fighting: 2, bug: 2, fairy: 2, ghost: 0.5, dark: 0.5, psychic: 0 },
  steel:    { fire: 2, fighting: 2, ground: 2, normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, dragon: 0.5, steel: 0.5, fairy: 0.5, poison: 0 },
  fairy:    { poison: 2, steel: 2, fighting: 0.5, bug: 0.5, dark: 0.5, dragon: 0 },
};

export const ALL_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

export function calculateWeaknesses(types) {
  const result = {};
  for (const atk of ALL_TYPES) {
    let mult = 1;
    for (const def of types) {
      const chart = TYPE_CHART[def] || {};
      if (chart[atk] !== undefined) mult *= chart[atk];
    }
    result[atk] = mult;
  }
  return result;
}

export function analyzeTeamCoverage(members) {
  const summary = {};
  for (const t of ALL_TYPES) summary[t] = { weakCount: 0, resistCount: 0, immuneCount: 0 };
  for (const m of members) {
    if (!m) continue;
    const w = calculateWeaknesses(m.types);
    for (const atk of ALL_TYPES) {
      if (w[atk] === 0) summary[atk].immuneCount++;
      else if (w[atk] < 1) summary[atk].resistCount++;
      else if (w[atk] > 1) summary[atk].weakCount++;
    }
  }
  return summary;
}

export function teamTotalStats(members) {
  const totals = { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  for (const m of members) {
    if (!m) continue;
    for (const k of Object.keys(totals)) totals[k] += m.stats?.[k] ?? 0;
  }
  return totals;
}

export const PokeData = {
  loadIndex,
  getPokemon,
  getSpecies,
  getEvolutionChain,
  getAbility,
  getMove,
  getSpanishName,
  getSpanishFlavor,
  getSpanishCategory,
  getSpanishAbilityName,
  getSpanishAbilityDesc,
  getSpanishMoveName,
  TYPE_ES, STAT_ES, ALL_TYPES, GENERATIONS,
  genFromId,
  spriteUrl, spriteUrlSmall,
  ensureSpanishName,
  spanishNameIndex,
  calculateWeaknesses,
  analyzeTeamCoverage,
  teamTotalStats,
};

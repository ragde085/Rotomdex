/* ============================================================
   Components — Card, Filters, Modal, etc.
   ============================================================ */

import { useState, useEffect, useMemo } from 'react';
import { PokeData } from './data.js';
import { t, typeName, statName } from './i18n.js';

export function CritterCard({ basic, inTeam, onOpen, onToggleTeam, lang = 'es' }) {
  const primaryType = basic.types?.[0];
  const cardBg = primaryType ? `color-mix(in oklab, var(--t-${primaryType}) 18%, var(--surface-2))` : 'var(--surface-2)';
  return (
    <div className="card" onClick={() => onOpen(basic.id)} style={{ '--card-bg': cardBg }}>
      <span className="num">N.º {String(basic.id).padStart(4, '0')}</span>
      <button
        className={'add-btn' + (inTeam ? ' in-team' : '')}
        onClick={(e) => { e.stopPropagation(); onToggleTeam(basic); }}
        title={inTeam ? 'Quitar' : '＋'}
      >
        {inTeam ? '✓' : '+'}
      </button>
      <div className="art-wrap">
        <img className="art" src={basic.art} alt={basic.name} loading="lazy"
             onError={(e) => { e.target.src = PokeData.spriteUrlSmall(basic.id); }} />
      </div>
      <div className="name">{basic.name}</div>
      <div className="types">
        {basic.types.map(ty => (
          <span key={ty} className="type-badge" style={{ '--type-color': `var(--t-${ty})` }}>
            {typeName(ty, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ filters, setFilters, lang = 'es' }) {
  const i18n = t(lang);
  const toggleType = (ty) => {
    const cur = new Set(filters.types);
    if (cur.has(ty)) cur.delete(ty); else cur.add(ty);
    setFilters({ ...filters, types: [...cur] });
  };
  const setGen = (g) => setFilters({ ...filters, gen: g });

  return (
    <div className="filters">
      <span className="filter-label">{i18n.filterType}</span>
      {PokeData.ALL_TYPES.map(ty => {
        const on = filters.types.includes(ty);
        return (
          <button
            key={ty}
            className={'type-chip' + (on ? ' on' : '')}
            style={{ '--type-color': `var(--t-${ty})` }}
            onClick={() => toggleType(ty)}
          >
            <span className="dot" />
            {typeName(ty, lang)}
          </button>
        );
      })}
      <span style={{ width: 12 }} />
      <span className="filter-label">{i18n.filterGen}</span>
      <select value={filters.gen} onChange={(e) => setGen(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }}>
        <option value="">{i18n.filterAll}</option>
        {PokeData.GENERATIONS.map(g => (
          <option key={g.id} value={g.id}>{g.name} · {g.region}</option>
        ))}
      </select>
      {(filters.types.length > 0 || filters.gen || filters.q) && (
        <button onClick={() => setFilters({ q: '', types: [], gen: '' })} style={{ marginLeft: 'auto' }}>
          {i18n.clearFilters}
        </button>
      )}
    </div>
  );
}

function spriteVariantLabel(parts, i18n) {
  const map = {
    front:       i18n.sprite.front,
    back:        i18n.sprite.back,
    shiny:       i18n.sprite.shiny,
    female:      i18n.sprite.female,
    gray:        i18n.sprite.gray,
    transparent: i18n.sprite.transparent,
  };
  return parts.map(p => map[p] || p).join(' · ');
}

function spriteGroupLabel(group, i18n) {
  const lookup = (path) => path.split('.').reduce((o, k) => o?.[k], i18n);
  let label = group.i18nKey ? lookup(group.i18nKey) : null;
  if (!label) label = group.text || group.groupKey;
  if (group.suffixI18nKey) {
    const suffix = lookup(group.suffixI18nKey);
    if (suffix) label = `${label} (${suffix})`;
  }
  return label;
}

export function DetailModal({ id, onClose, onToggleTeam, inTeam, openId, lang = 'es' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [spriteKey, setSpriteKey] = useState('official-artwork:front_default');
  const i18n = t(lang);

  useEffect(() => {
    setData(null); setError(null); setSpriteKey('official-artwork:front_default');
    let cancel = false;
    (async () => {
      try {
        const [poke, species] = await Promise.all([
          PokeData.getPokemon(id),
          PokeData.getSpecies(id),
        ]);
        const types = poke.types.map(ty => ty.type.name);
        const stats = {};
        for (const s of poke.stats) stats[s.stat.name] = s.base_stat;
        const total = Object.values(stats).reduce((a, b) => a + b, 0);

        const abilities = await Promise.all(poke.abilities.map(async a => {
          const ab = await PokeData.getAbility(a.ability.name);
          return {
            name: PokeData.getAbilityName(ab, lang),
            desc: PokeData.getAbilityDesc(ab, lang),
            hidden: a.is_hidden,
          };
        }));

        const moveRefs = poke.moves.slice(0, 12).map(m => m.move);
        const moves = await Promise.all(moveRefs.slice(0, 6).map(async ref => {
          try {
            const mv = await PokeData.getMove(ref.name);
            return {
              name: PokeData.getMoveName(mv, lang),
              type: mv.type.name,
              power: mv.power,
              accuracy: mv.accuracy,
            };
          } catch { return { name: ref.name, type: 'normal' }; }
        }));

        let evoTree = null;
        if (species.evolution_chain?.url) {
          try {
            const evo = await PokeData.getEvolutionChain(species.evolution_chain.url);
            evoTree = await buildEvoTree(evo.chain, lang);
          } catch (e) {}
        }

        if (cancel) return;
        setData({
          id,
          name: PokeData.getName(species, lang),
          category: PokeData.getCategory(species, lang),
          flavor: PokeData.getFlavor(species, lang),
          types,
          stats,
          total,
          height: poke.height / 10,
          weight: poke.weight / 10,
          abilities,
          moves,
          evoTree,
          weaknesses: PokeData.calculateWeaknesses(types),
          art: PokeData.spriteUrl(id),
          sprites: poke.sprites,
        });
      } catch (e) {
        if (!cancel) setError(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [id, lang]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const heroBg = data?.types?.[0] ? `color-mix(in oklab, var(--t-${data.types[0]}) 80%, var(--ink))` : 'var(--bg-2)';

  const spriteGroups = useMemo(() => {
    if (!data) return [];
    const groups = PokeData.spriteSources(data.sprites);
    // Guarantee an "official-artwork" entry even if the API didn't include
    // it (some forms have an empty other.official-artwork): the URL we
    // already pre-computed in data.art points at the same asset.
    if (!groups.find(g => g.groupKey === 'official-artwork')) {
      groups.unshift({
        groupKey: 'official-artwork',
        i18nKey: 'sprite.officialArtwork',
        pixel: false,
        variants: [{ key: 'front_default', url: data.art, parts: ['front'] }],
      });
    }
    return groups;
  }, [data]);

  const flatVariants = useMemo(() => {
    const arr = [];
    for (const g of spriteGroups) {
      for (const v of g.variants) {
        arr.push({ key: `${g.groupKey}:${v.key}`, url: v.url, parts: v.parts, pixel: !!g.pixel });
      }
    }
    return arr;
  }, [spriteGroups]);

  const currentVariant = flatVariants.find(v => v.key === spriteKey) || flatVariants[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={i18n.detail}>
        <button className="modal-close" onClick={onClose} aria-label={i18n.close}>×</button>
        {!data && !error && <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /><p>{i18n.loading}</p></div>}
        {error && <div style={{ padding: 60, textAlign: 'center' }}><h3>{i18n.oops}</h3><p>{i18n.loadFailed}</p></div>}
        {data && (
          <>
            <div className="modal-hero" style={{ '--hero-bg': heroBg }}>
              <div>
                <div className="num-big">N.º {String(data.id).padStart(4, '0')}</div>
                <h2 className="name-big">{data.name}</h2>
                {data.category && <div className="category">{data.category}</div>}
                <div className="types">
                  {data.types.map(ty => (
                    <span key={ty} className="type-badge" style={{ '--type-color': `var(--t-${ty})` }}>
                      {typeName(ty, lang)}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => onToggleTeam(data)} style={{ background: inTeam ? 'var(--ink)' : 'var(--accent)', color: inTeam ? 'var(--bg)' : 'var(--accent-ink)' }}>
                    {inTeam ? i18n.inTeam : i18n.addToTeam}
                  </button>
                </div>
              </div>
              <div className="art-big">
                <img
                  src={currentVariant?.url}
                  alt={data.name}
                  className={currentVariant?.pixel ? 'pixel' : ''}
                  onError={(e) => { e.target.src = PokeData.spriteUrlSmall(data.id); }}
                />
              </div>
            </div>

            {flatVariants.length > 1 && (
              <div className="sprite-picker">
                <label className="sprite-picker-label" htmlFor="sprite-select">{i18n.section.sprites}</label>
                <select
                  id="sprite-select"
                  className="sprite-select"
                  value={currentVariant ? currentVariant.key : ''}
                  onChange={(e) => setSpriteKey(e.target.value)}
                >
                  {spriteGroups.map(g => (
                    <optgroup key={g.groupKey} label={spriteGroupLabel(g, i18n)}>
                      {g.variants.map(v => (
                        <option key={`${g.groupKey}:${v.key}`} value={`${g.groupKey}:${v.key}`}>
                          {spriteVariantLabel(v.parts, i18n)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-body">
              <section style={{ gridColumn: '1 / -1' }}>
                <p className="flavor-text">{data.flavor || i18n.noFlavor}</p>
              </section>

              <section>
                <h3>{i18n.section.data}</h3>
                <div className="facts">
                  <div className="fact">
                    <div className="lbl">{i18n.height}</div>
                    <div className="val">{data.height} m</div>
                  </div>
                  <div className="fact">
                    <div className="lbl">{i18n.weight}</div>
                    <div className="val">{data.weight} kg</div>
                  </div>
                  <div className="fact">
                    <div className="lbl">{i18n.gen}</div>
                    <div className="val">{PokeData.genFromId(data.id)?.name?.replace('Gen ','') || '—'}</div>
                  </div>
                </div>
              </section>

              <section>
                <h3>{i18n.section.stats}</h3>
                <div className="stats">
                  {['hp','attack','defense','special-attack','special-defense','speed'].map(k => (
                    <div key={k} className="stat-row">
                      <span className="lbl">{statName(k, lang)}</span>
                      <span className="val">{data.stats[k]}</span>
                      <div className="stat-bar">
                        <span style={{ width: `${Math.min(100, (data.stats[k] / 200) * 100)}%`, background: `var(--t-${data.types[0]})` }} />
                      </div>
                    </div>
                  ))}
                  <div className="stat-row total">
                    <span className="lbl">{i18n.total}</span>
                    <span className="val">{data.total}</span>
                    <div className="stat-bar">
                      <span style={{ width: `${Math.min(100, (data.total / 720) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3>{i18n.section.abilities}</h3>
                {data.abilities.map((a, i) => (
                  <div key={i} className="ability">
                    <div className="nm">
                      {a.name}
                      {a.hidden && <span className="hidden-tag">{i18n.hidden}</span>}
                    </div>
                    {a.desc && <div className="desc">{a.desc}</div>}
                  </div>
                ))}
              </section>

              <section>
                <h3>{i18n.section.weaknesses}</h3>
                <div className="weakness-grid">
                  {PokeData.ALL_TYPES.map(ty => {
                    const m = data.weaknesses[ty];
                    let cls = '';
                    if (m === 0) cls = 'immune';
                    else if (m === 4) cls = 'veryweak';
                    else if (m === 2) cls = 'weak';
                    else if (m === 0.5) cls = 'resist';
                    else if (m === 0.25) cls = 'veryresist';
                    if (m === 1) return null;
                    return (
                      <div key={ty} className={'weak-cell ' + cls}>
                        <span className="type-badge" style={{ '--type-color': `var(--t-${ty})`, fontSize: 9, padding: '2px 6px' }}>
                          {typeName(ty, lang)}
                        </span>
                        <span className="mult">×{m}</span>
                      </div>
                    );
                  })}
                  {Object.values(data.weaknesses).every(m => m === 1) && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{i18n.noWeaknesses}</p>}
                </div>
              </section>

              <section>
                <h3>{i18n.section.moves}</h3>
                <div className="move-list">
                  {data.moves.map((m, i) => (
                    <div key={i} className="move-item">
                      <div>
                        <div className="nm">{m.name}</div>
                        <span className="type-badge" style={{ '--type-color': `var(--t-${m.type})`, fontSize: 9, padding: '1px 6px', marginTop: 2 }}>
                          {typeName(m.type, lang)}
                        </span>
                      </div>
                      <div className="meta">
                        {m.power ? `${i18n.pwr} ${m.power}` : '—'}<br/>
                        {m.accuracy ? `${i18n.acc} ${m.accuracy}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {data.evoTree && evoTreeSize(data.evoTree) > 1 && (
                <section style={{ gridColumn: '1 / -1' }}>
                  <h3>{i18n.section.evo}</h3>
                  <div className="evo-chain">
                    <EvoNodeView node={data.evoTree} openId={openId} />
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function buildEvoTree(node, lang, condition = null) {
  const speciesName = node.species.name;
  const m = node.species.url.match(/\/pokemon-species\/(\d+)\//);
  const id = m ? parseInt(m[1], 10) : null;
  let name = speciesName;
  try {
    const sp = await PokeData.getSpecies(speciesName);
    name = PokeData.getName(sp, lang);
  } catch {}
  const children = [];
  for (const child of (node.evolves_to || [])) {
    const det = (child.evolution_details || [])[0] || {};
    let cond = '';
    if (det.min_level) cond = `Nv. ${det.min_level}`;
    else if (det.item) cond = `${det.item.name.replace(/-/g,' ')}`;
    else if (det.trigger?.name === 'trade') cond = '⇄';
    else if (det.min_happiness) cond = '♥';
    children.push(await buildEvoTree(child, lang, cond));
  }
  return { id, name, condition, children };
}

function evoTreeSize(tree) {
  if (!tree) return 0;
  return 1 + tree.children.reduce((a, c) => a + evoTreeSize(c), 0);
}

function EvoNodeView({ node, openId }) {
  return (
    <div className="evo-node-wrap">
      <div className="evo-node" onClick={() => openId(node.id)}>
        <img src={PokeData.spriteUrlSmall(node.id)} alt={node.name} />
        <span className="nm">{node.name}</span>
      </div>
      {node.children.length > 0 && (
        <div className="evo-branches">
          {node.children.map((c, i) => (
            <div className="evo-branch" key={c.id + '-' + i}>
              <div className="evo-arrow">
                →<span className="cond">{c.condition || ''}</span>
              </div>
              <EvoNodeView node={c} openId={openId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

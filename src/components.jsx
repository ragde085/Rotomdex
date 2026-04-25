/* ============================================================
   Components — Card, Filters, Modal, etc.
   ============================================================ */

import React, { useState, useEffect } from 'react';
import { PokeData } from './data.js';

export function CritterCard({ basic, inTeam, onOpen, onToggleTeam }) {
  const primaryType = basic.types?.[0];
  const cardBg = primaryType ? `color-mix(in oklab, var(--t-${primaryType}) 18%, var(--surface-2))` : 'var(--surface-2)';
  return (
    <div className="card" onClick={() => onOpen(basic.id)} style={{ '--card-bg': cardBg }}>
      <span className="num">N.º {String(basic.id).padStart(4, '0')}</span>
      <button
        className={'add-btn' + (inTeam ? ' in-team' : '')}
        onClick={(e) => { e.stopPropagation(); onToggleTeam(basic); }}
        title={inTeam ? 'Quitar del equipo' : 'Añadir al equipo'}
      >
        {inTeam ? '✓' : '+'}
      </button>
      <div className="art-wrap">
        <img className="art" src={basic.art} alt={basic.name} loading="lazy"
             onError={(e) => { e.target.src = PokeData.spriteUrlSmall(basic.id); }} />
      </div>
      <div className="name">{basic.name}</div>
      <div className="types">
        {basic.types.map(t => (
          <span key={t} className="type-badge" style={{ '--type-color': `var(--t-${t})` }}>
            {PokeData.TYPE_ES[t] || t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ filters, setFilters }) {
  const toggleType = (t) => {
    const cur = new Set(filters.types);
    if (cur.has(t)) cur.delete(t); else cur.add(t);
    setFilters({ ...filters, types: [...cur] });
  };
  const setGen = (g) => setFilters({ ...filters, gen: g });

  return (
    <div className="filters">
      <span className="filter-label">Tipo</span>
      {PokeData.ALL_TYPES.map(t => {
        const on = filters.types.includes(t);
        return (
          <button
            key={t}
            className={'type-chip' + (on ? ' on' : '')}
            style={{ '--type-color': `var(--t-${t})` }}
            onClick={() => toggleType(t)}
          >
            <span className="dot" />
            {PokeData.TYPE_ES[t]}
          </button>
        );
      })}
      <span style={{ width: 12 }} />
      <span className="filter-label">Gen</span>
      <select value={filters.gen} onChange={(e) => setGen(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }}>
        <option value="">Todas</option>
        {PokeData.GENERATIONS.map(g => (
          <option key={g.id} value={g.id}>{g.name} · {g.region}</option>
        ))}
      </select>
      {(filters.types.length > 0 || filters.gen || filters.q) && (
        <button onClick={() => setFilters({ q: '', types: [], gen: '' })} style={{ marginLeft: 'auto' }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

export function DetailModal({ id, onClose, onToggleTeam, inTeam, openId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null); setError(null);
    let cancel = false;
    (async () => {
      try {
        const [poke, species] = await Promise.all([
          PokeData.getPokemon(id),
          PokeData.getSpecies(id),
        ]);
        const types = poke.types.map(t => t.type.name);
        const stats = {};
        for (const s of poke.stats) stats[s.stat.name] = s.base_stat;
        const total = Object.values(stats).reduce((a, b) => a + b, 0);

        const abilities = await Promise.all(poke.abilities.map(async a => {
          const ab = await PokeData.getAbility(a.ability.name);
          return {
            name: PokeData.getSpanishAbilityName(ab),
            desc: PokeData.getSpanishAbilityDesc(ab),
            hidden: a.is_hidden,
          };
        }));

        const moveRefs = poke.moves.slice(0, 12).map(m => m.move);
        const moves = await Promise.all(moveRefs.slice(0, 6).map(async ref => {
          try {
            const mv = await PokeData.getMove(ref.name);
            return {
              name: PokeData.getSpanishMoveName(mv),
              type: mv.type.name,
              power: mv.power,
              accuracy: mv.accuracy,
            };
          } catch { return { name: ref.name, type: 'normal' }; }
        }));

        let evoChain = [];
        if (species.evolution_chain?.url) {
          try {
            const evo = await PokeData.getEvolutionChain(species.evolution_chain.url);
            evoChain = await flattenEvoChain(evo.chain);
          } catch (e) {}
        }

        if (cancel) return;
        setData({
          id,
          name: PokeData.getSpanishName(species),
          category: PokeData.getSpanishCategory(species),
          flavor: PokeData.getSpanishFlavor(species),
          types,
          stats,
          total,
          height: poke.height / 10,
          weight: poke.weight / 10,
          abilities,
          moves,
          evoChain,
          weaknesses: PokeData.calculateWeaknesses(types),
          art: PokeData.spriteUrl(id),
        });
      } catch (e) {
        if (!cancel) setError(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const heroBg = data?.types?.[0] ? `color-mix(in oklab, var(--t-${data.types[0]}) 80%, var(--ink))` : 'var(--bg-2)';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        {!data && !error && <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /><p>Cargando…</p></div>}
        {error && <div style={{ padding: 60, textAlign: 'center' }}><h3>Ups</h3><p>No se pudo cargar.</p></div>}
        {data && (
          <>
            <div className="modal-hero" style={{ '--hero-bg': heroBg }}>
              <div>
                <div className="num-big">N.º {String(data.id).padStart(4, '0')}</div>
                <h2 className="name-big">{data.name}</h2>
                {data.category && <div className="category">{data.category}</div>}
                <div className="types">
                  {data.types.map(t => (
                    <span key={t} className="type-badge" style={{ '--type-color': `var(--t-${t})` }}>
                      {PokeData.TYPE_ES[t]}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => onToggleTeam(data)} style={{ background: inTeam ? 'var(--ink)' : 'var(--accent)', color: inTeam ? 'var(--bg)' : 'var(--accent-ink)' }}>
                    {inTeam ? '✓ En el equipo' : '＋ Añadir al equipo'}
                  </button>
                </div>
              </div>
              <div className="art-big">
                <img src={data.art} alt={data.name} onError={(e) => { e.target.src = PokeData.spriteUrlSmall(data.id); }} />
              </div>
            </div>
            <div className="modal-body">
              <section style={{ gridColumn: '1 / -1' }}>
                <p className="flavor-text">{data.flavor || 'Sin descripción disponible.'}</p>
              </section>

              <section>
                <h3>Datos</h3>
                <div className="facts">
                  <div className="fact">
                    <div className="lbl">Altura</div>
                    <div className="val">{data.height} m</div>
                  </div>
                  <div className="fact">
                    <div className="lbl">Peso</div>
                    <div className="val">{data.weight} kg</div>
                  </div>
                  <div className="fact">
                    <div className="lbl">Gen</div>
                    <div className="val">{PokeData.genFromId(data.id)?.name?.replace('Gen ','') || '—'}</div>
                  </div>
                </div>
              </section>

              <section>
                <h3>Estadísticas base</h3>
                <div className="stats">
                  {['hp','attack','defense','special-attack','special-defense','speed'].map(k => (
                    <div key={k} className="stat-row">
                      <span className="lbl">{PokeData.STAT_ES[k]}</span>
                      <span className="val">{data.stats[k]}</span>
                      <div className="stat-bar">
                        <span style={{ width: `${Math.min(100, (data.stats[k] / 200) * 100)}%`, background: `var(--t-${data.types[0]})` }} />
                      </div>
                    </div>
                  ))}
                  <div className="stat-row total">
                    <span className="lbl">Total</span>
                    <span className="val">{data.total}</span>
                    <div className="stat-bar">
                      <span style={{ width: `${Math.min(100, (data.total / 720) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3>Habilidades</h3>
                {data.abilities.map((a, i) => (
                  <div key={i} className="ability">
                    <div className="nm">
                      {a.name}
                      {a.hidden && <span className="hidden-tag">Oculta</span>}
                    </div>
                    {a.desc && <div className="desc">{a.desc}</div>}
                  </div>
                ))}
              </section>

              <section>
                <h3>Debilidades y resistencias</h3>
                <div className="weakness-grid">
                  {PokeData.ALL_TYPES.map(t => {
                    const m = data.weaknesses[t];
                    let cls = '';
                    if (m === 0) cls = 'immune';
                    else if (m === 4) cls = 'veryweak';
                    else if (m === 2) cls = 'weak';
                    else if (m === 0.5) cls = 'resist';
                    else if (m === 0.25) cls = 'veryresist';
                    if (m === 1) return null;
                    return (
                      <div key={t} className={'weak-cell ' + cls}>
                        <span className="type-badge" style={{ '--type-color': `var(--t-${t})`, fontSize: 9, padding: '2px 6px' }}>
                          {PokeData.TYPE_ES[t]}
                        </span>
                        <span className="mult">×{m}</span>
                      </div>
                    );
                  })}
                  {Object.values(data.weaknesses).every(m => m === 1) && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Sin debilidades ni resistencias notables.</p>}
                </div>
              </section>

              <section>
                <h3>Movimientos destacados</h3>
                <div className="move-list">
                  {data.moves.map((m, i) => (
                    <div key={i} className="move-item">
                      <div>
                        <div className="nm">{m.name}</div>
                        <span className="type-badge" style={{ '--type-color': `var(--t-${m.type})`, fontSize: 9, padding: '1px 6px', marginTop: 2 }}>
                          {PokeData.TYPE_ES[m.type]}
                        </span>
                      </div>
                      <div className="meta">
                        {m.power ? `Pot ${m.power}` : '—'}<br/>
                        {m.accuracy ? `Pre ${m.accuracy}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {data.evoChain.length > 1 && (
                <section style={{ gridColumn: '1 / -1' }}>
                  <h3>Cadena de evolución</h3>
                  <div className="evo-chain">
                    {data.evoChain.map((node, i) => (
                      <React.Fragment key={node.id + '-' + i}>
                        {i > 0 && (
                          <div className="evo-arrow">
                            →
                            <span className="cond">{node.condition || ''}</span>
                          </div>
                        )}
                        <div className="evo-node" onClick={() => openId(node.id)}>
                          <img src={PokeData.spriteUrlSmall(node.id)} alt={node.name} />
                          <span className="nm">{node.name}</span>
                        </div>
                      </React.Fragment>
                    ))}
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

async function flattenEvoChain(node, condition = null) {
  const out = [];
  const speciesName = node.species.name;
  const m = node.species.url.match(/\/pokemon-species\/(\d+)\//);
  const id = m ? parseInt(m[1], 10) : null;
  let name = speciesName;
  try {
    const sp = await PokeData.getSpecies(speciesName);
    name = PokeData.getSpanishName(sp);
  } catch {}
  out.push({ id, name, condition });
  for (const child of (node.evolves_to || [])) {
    const det = (child.evolution_details || [])[0] || {};
    let cond = '';
    if (det.min_level) cond = `Nv. ${det.min_level}`;
    else if (det.item) cond = `${det.item.name.replace(/-/g,' ')}`;
    else if (det.trigger?.name === 'trade') cond = 'Intercambio';
    else if (det.min_happiness) cond = 'Felicidad';
    const childOut = await flattenEvoChain(child, cond);
    out.push(...childOut);
  }
  return out;
}

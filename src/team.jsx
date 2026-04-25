/* ============================================================
   Team builder view — slots, drag/drop, coverage, multiple teams, share URL
   ============================================================ */

import { useState, useMemo } from 'react';
import { PokeData } from './data.js';

const TEAMS_STORAGE_KEY = 'criaturas:teams:v1';

export function loadTeams() {
  try {
    const raw = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { active: 'team-1', list: [{ id: 'team-1', name: 'Mi equipo', members: [] }] };
}
export function saveTeams(state) {
  try { localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function encodeTeamToUrl(team) {
  const ids = team.members.map(m => m.id).join(',');
  const name = encodeURIComponent(team.name);
  return `#team=${name}|${ids}`;
}
export function decodeTeamFromUrl() {
  const h = window.location.hash;
  const m = h.match(/#team=([^|]+)\|([\d,]*)/);
  if (!m) return null;
  const name = decodeURIComponent(m[1]);
  const ids = m[2].split(',').filter(Boolean).map(Number);
  return { name, ids };
}

export function TeamView({ teamsState, setTeamsState, onOpenDetail, onToast }) {
  const active = teamsState.list.find(t => t.id === teamsState.active) || teamsState.list[0];

  const updateActive = (mut) => {
    const next = { ...teamsState };
    next.list = next.list.map(t => t.id === active.id ? mut(t) : t);
    setTeamsState(next);
    saveTeams(next);
  };

  const setName = (name) => updateActive(t => ({ ...t, name }));
  const removeMember = (idx) => updateActive(t => {
    const m = [...t.members]; m.splice(idx, 1); return { ...t, members: m };
  });

  const [dragIdx, setDragIdx] = useState(null);
  const onDragStart = (i) => setDragIdx(i);
  const onDragEnd = () => setDragIdx(null);
  const onDrop = (toIdx) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    updateActive(t => {
      const m = [...t.members];
      const [moved] = m.splice(dragIdx, 1);
      m.splice(toIdx, 0, moved);
      return { ...t, members: m };
    });
    setDragIdx(null);
  };

  const newTeam = () => {
    const id = 'team-' + Date.now();
    const next = { active: id, list: [...teamsState.list, { id, name: 'Equipo nuevo', members: [] }] };
    setTeamsState(next);
    saveTeams(next);
  };
  const switchTeam = (id) => {
    const next = { ...teamsState, active: id };
    setTeamsState(next); saveTeams(next);
  };
  const deleteTeam = (id) => {
    if (teamsState.list.length === 1) return;
    const list = teamsState.list.filter(t => t.id !== id);
    const next = { active: list[0].id, list };
    setTeamsState(next); saveTeams(next);
  };
  const shareTeam = async () => {
    const url = window.location.origin + window.location.pathname + encodeTeamToUrl(active);
    try {
      await navigator.clipboard.writeText(url);
      onToast('🔗 Enlace copiado');
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  };

  const totals = useMemo(() => PokeData.teamTotalStats(active.members), [active.members]);
  const coverage = useMemo(() => PokeData.analyzeTeamCoverage(active.members), [active.members]);

  return (
    <div className="team-view">
      <div className="team-header">
        <input className="team-title-input" value={active.name} onChange={(e) => setName(e.target.value)} />
        <button onClick={shareTeam} disabled={active.members.length === 0}>🔗 Compartir</button>
        <button onClick={newTeam}>＋ Nuevo equipo</button>
      </div>

      <div className="team-list-mgr" style={{ marginTop: 0, marginBottom: 16 }}>
        {teamsState.list.map(t => (
          <span key={t.id}
                className={'team-chip' + (t.id === active.id ? ' active' : '')}
                onClick={() => switchTeam(t.id)}>
            {t.name} <span style={{ opacity: 0.7 }}>· {t.members.length}/6</span>
            {teamsState.list.length > 1 && (
              <span className="x" onClick={(e) => { e.stopPropagation(); deleteTeam(t.id); }}>×</span>
            )}
          </span>
        ))}
      </div>

      <div className="team-slots">
        {Array.from({ length: 6 }).map((_, i) => {
          const m = active.members[i];
          if (!m) return (
            <div key={i} className="slot empty">
              <span className="plus">＋</span>
              <span className="lbl">Vacío</span>
            </div>
          );
          const slotBg = `color-mix(in oklab, var(--t-${m.types[0]}) 18%, var(--surface))`;
          return (
            <div
              key={m.id}
              className={'slot filled' + (dragIdx === i ? ' dragging' : '')}
              style={{ '--slot-bg': slotBg }}
              draggable="true"
              onDragStart={() => onDragStart(i)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => { e.currentTarget.classList.remove('drag-over'); onDrop(i); }}
              onClick={() => onOpenDetail(m.id)}
            >
              <span className="order">#{i + 1}</span>
              <button className="remove" onClick={(e) => { e.stopPropagation(); removeMember(i); }}>×</button>
              <img className="slot-art" src={PokeData.spriteUrl(m.id)} alt={m.name}
                   onError={(e) => { e.target.src = PokeData.spriteUrlSmall(m.id); }} />
              <div className="slot-name">{m.name}</div>
              <div className="slot-types">
                {m.types.map(t => (
                  <span key={t} className="type-badge" style={{ '--type-color': `var(--t-${t})` }}>
                    {PokeData.TYPE_ES[t]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {active.members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
          <h3 style={{ fontSize: 24, marginBottom: 8, color: 'var(--ink)' }}>Tu equipo está vacío</h3>
          <p>Ve al catálogo y pulsa el ＋ en cualquier criatura.</p>
        </div>
      ) : (
        <div className="team-stats-grid">
          <div className="team-card">
            <h3>Estadísticas totales</h3>
            <div className="stats">
              {['hp','attack','defense','special-attack','special-defense','speed'].map(k => (
                <div key={k} className="stat-row">
                  <span className="lbl">{PokeData.STAT_ES[k]}</span>
                  <span className="val">{totals[k]}</span>
                  <div className="stat-bar">
                    <span style={{ width: `${Math.min(100, (totals[k] / 1200) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="stat-row total">
                <span className="lbl">Total</span>
                <span className="val">{Object.values(totals).reduce((a,b)=>a+b,0)}</span>
                <div className="stat-bar">
                  <span style={{ width: `${Math.min(100, (Object.values(totals).reduce((a,b)=>a+b,0) / 4320) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="team-card">
            <h3>Cobertura defensiva</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, marginTop: -6 }}>
              Cuántos miembros son débiles, resistentes o inmunes a cada tipo.
            </p>
            {PokeData.ALL_TYPES.map(t => {
              const c = coverage[t];
              const balance = c.resistCount + c.immuneCount - c.weakCount;
              const isWeak = c.weakCount > c.resistCount + c.immuneCount;
              const isGood = c.resistCount + c.immuneCount > c.weakCount;
              const total = c.weakCount + c.resistCount + c.immuneCount;
              return (
                <div key={t} className="coverage-row">
                  <span className="type-badge" style={{ '--type-color': `var(--t-${t})`, fontSize: 10 }}>
                    {PokeData.TYPE_ES[t]}
                  </span>
                  <div className={'coverage-bar ' + (isWeak ? 'bad' : isGood ? 'good' : '')}>
                    <span style={{ width: `${total === 0 ? 0 : Math.abs(balance) / 6 * 100}%`, background: isWeak ? 'var(--t-fire)' : isGood ? 'var(--t-grass)' : 'var(--ink-3)' }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: isWeak ? 'var(--t-fire)' : isGood ? 'var(--t-grass)' : 'var(--ink-3)' }}>
                    {balance > 0 ? '+' : ''}{balance}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="team-card" style={{ gridColumn: '1 / -1' }}>
            <h3>Debilidades compartidas (×2 o más)</h3>
            <SharedWeaknesses members={active.members} />
          </div>
        </div>
      )}
    </div>
  );
}

function SharedWeaknesses({ members }) {
  const items = PokeData.ALL_TYPES.map(t => {
    const weakMembers = members.filter(m => {
      const w = PokeData.calculateWeaknesses(m.types);
      return w[t] > 1;
    });
    return { type: t, count: weakMembers.length, members: weakMembers };
  }).filter(x => x.count >= 2).sort((a,b) => b.count - a.count);

  if (items.length === 0) {
    return <p style={{ color: 'var(--ink-3)' }}>✓ No hay debilidades compartidas notables. ¡Buen balance!</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
      {items.map(({ type, count, members }) => (
        <div key={type} style={{ padding: 10, background: 'var(--surface-2)', border: '2px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="type-badge" style={{ '--type-color': `var(--t-${type})` }}>
              {PokeData.TYPE_ES[type]}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--t-fire)' }}>×{count} débiles</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', textTransform: 'capitalize' }}>
            {members.map(m => m.name).join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}

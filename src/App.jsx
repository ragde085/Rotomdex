/* ============================================================
   App — main shell, search, infinite scroll, routing between views
   ============================================================ */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PokeData } from './data.js';
import { CritterCard, FilterBar, DetailModal } from './components.jsx';
import { TeamView, loadTeams, saveTeams, decodeTeamFromUrl } from './team.jsx';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakSelect,
  TweakColor,
} from './tweaks-panel.jsx';
import { LANG_OPTIONS, t } from './i18n.js';

const PAGE_SIZE = 36;

const WELCOME_KEY = 'criaturas:welcome-dismissed:v1';

function WelcomeBanner() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(WELCOME_KEY) !== '1'; } catch { return true; }
  });
  if (!open) return null;
  const dismiss = () => {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
    setOpen(false);
  };
  return (
    <div className="welcome">
      <button className="welcome-close" onClick={dismiss} aria-label="Cerrar bienvenida">×</button>
      <h2>⚡ ¡Bzzt! Bienvenido a Rotomdex</h2>
      <p className="welcome-sub">
        Pokédex con la onda eléctrica de Rotom: catálogo y gestor de equipos en español, con datos de PokéAPI.
      </p>
      <ul className="welcome-list">
        <li><b>Buscar</b> por nombre (ES o EN) o número en la barra superior.</li>
        <li><b>Filtrar</b> por tipo y generación bajo la barra de búsqueda.</li>
        <li><b>Detalle</b>: pulsa cualquier carta para ver stats, habilidades, debilidades y evolución.</li>
        <li><b>Equipo</b>: pulsa <code>+</code> en una carta para añadirla (máx. 6). Cambia a <i>Mi Equipo</i> para reordenar y ver cobertura.</li>
        <li><b>Compartir</b>: en <i>Mi Equipo</i>, el botón 🔗 copia un enlace con tu equipo.</li>
        <li><b>Idioma</b> y <b>tema</b>: abre los Tweaks (esquina inferior derecha) para cambiar idioma de los datos, tema y acento.</li>
      </ul>
      <button className="welcome-cta" onClick={dismiss}>Entendido</button>
    </div>
  );
}

export default function App() {
  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "theme": "light",
    "density": "comfortable",
    "accent": "#e63333",
    "lang": "es"
  }/*EDITMODE-END*/);
  const lang = tweaks.lang || 'es';
  const i18n = t(lang);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    const ink = isLight(tweaks.accent) ? '#2a1410' : '#fff';
    document.documentElement.style.setProperty('--accent-ink', ink);
    const d = tweaks.density === 'compact' ? 0.85 : tweaks.density === 'spacious' ? 1.15 : 1;
    document.documentElement.style.setProperty('--density', d);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const [view, setView] = useState('catalog');
  const [filters, setFilters] = useState({ q: '', types: [], gen: '' });
  const [index, setIndex] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [filteredIds, setFilteredIds] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [teamsState, setTeamsState] = useState(loadTeams());
  const [toast, setToast] = useState(null);

  const onToast = (msg) => {
    setToast(msg);
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    PokeData.loadIndex().then(setIndex).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    const shared = decodeTeamFromUrl();
    if (shared && shared.ids.length > 0) {
      Promise.all(shared.ids.map(id => hydrateBasic(id, lang))).then(members => {
        const id = 'team-shared-' + Date.now();
        const next = {
          active: id,
          list: [...teamsState.list, { id, name: shared.name + ' (compartido)', members: members.filter(Boolean) }],
        };
        setTeamsState(next); saveTeams(next);
        setView('team');
        onToast(i18n.sharedTeamLoaded);
        history.replaceState(null, '', window.location.pathname);
      });
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (index.length === 0) return;
    let cancel = false;
    (async () => {
      let pool = index;
      if (filters.gen) {
        const g = PokeData.GENERATIONS.find(x => String(x.id) === String(filters.gen));
        if (g) pool = pool.filter(p => p.id >= g.range[0] && p.id <= g.range[1]);
      }
      const q = filters.q.trim().toLowerCase();
      if (q) {
        if (/^\d+$/.test(q)) {
          const n = parseInt(q, 10);
          pool = pool.filter(p => p.id === n || String(p.id).includes(q));
        } else {
          let englishMatches = pool.filter(p => p.name.includes(q));
          const localizedMatches = pool.filter(p => {
            const sp = PokeData.getCachedName(p.id, lang);
            return sp && sp.includes(q);
          });
          const toFetch = pool.slice(0, 200).filter(p => !PokeData.hasCachedName(p.id, lang)).slice(0, 60);
          if (toFetch.length > 0) {
            await Promise.all(toFetch.map(p => PokeData.ensureName(p.id, lang).catch(() => null)));
            if (cancel) return;
            const moreLocalized = pool.filter(p => {
              const sp = PokeData.getCachedName(p.id, lang);
              return sp && sp.includes(q);
            });
            const ids = new Set([...englishMatches, ...moreLocalized].map(p => p.id));
            pool = pool.filter(p => ids.has(p.id));
          } else {
            const ids = new Set([...englishMatches, ...localizedMatches].map(p => p.id));
            pool = pool.filter(p => ids.has(p.id));
          }
        }
      }
      if (cancel) return;
      setFilteredIds(pool.map(p => p.id));
      setItems([]); setPage(0); setDone(false);
    })();
    return () => { cancel = true; };
  }, [filters.q, filters.gen, filters.types, index, lang]);

  async function hydrateBasic(id, lng) {
    try {
      const poke = await PokeData.getPokemon(id);
      const types = poke.types.map(t => t.type.name);
      const stats = {};
      for (const s of poke.stats) stats[s.stat.name] = s.base_stat;
      let name;
      try {
        const sp = await PokeData.getSpecies(id);
        name = PokeData.getName(sp, lng);
        PokeData.setCachedName(id, lng, name.toLowerCase());
      } catch {
        name = poke.name;
      }
      return {
        id,
        name,
        types,
        stats,
        art: PokeData.spriteUrl(id),
      };
    } catch (e) {
      return null;
    }
  }

  const loadPage = useCallback(async () => {
    if (loading || done) return;
    if (filteredIds === null && index.length === 0) return;
    setLoading(true);
    const ids = (filteredIds ?? index.map(p => p.id));
    const start = page * PAGE_SIZE;
    let collected = [];
    let cur = start;
    while (collected.length < PAGE_SIZE && cur < ids.length) {
      const slice = ids.slice(cur, cur + PAGE_SIZE);
      cur += PAGE_SIZE;
      const hydrated = (await Promise.all(slice.map(id => hydrateBasic(id, lang)))).filter(Boolean);
      let kept = hydrated;
      if (filters.types.length > 0) {
        kept = hydrated.filter(h => filters.types.every(t => h.types.includes(t)));
      }
      collected.push(...kept);
      if (cur >= ids.length) break;
    }
    setItems(prev => [...prev, ...collected]);
    setPage(p => p + 1);
    if (cur >= ids.length) setDone(true);
    setLoading(false);
  }, [loading, done, page, filteredIds, index, filters.types, lang]);

  useEffect(() => {
    if (filteredIds !== null && items.length === 0 && !loading) {
      loadPage();
    }
  }, [filteredIds, items.length, loadPage, loading]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadPage();
    }, { rootMargin: '400px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadPage]);

  const activeTeam = teamsState.list.find(t => t.id === teamsState.active) || teamsState.list[0];
  const inTeamIds = useMemo(() => new Set(activeTeam.members.map(m => m.id)), [activeTeam.members]);

  const toggleInTeam = (basic) => {
    const cur = activeTeam.members;
    const isIn = cur.some(m => m.id === basic.id);
    let next;
    if (isIn) {
      next = cur.filter(m => m.id !== basic.id);
      onToast(i18n.removedFromTeam(basic.name));
    } else if (cur.length >= 6) {
      onToast(i18n.teamFull);
      return;
    } else {
      next = [...cur, { id: basic.id, name: basic.name, types: basic.types, stats: basic.stats }];
      onToast(i18n.addedToTeam(basic.name));
    }
    const newState = { ...teamsState, list: teamsState.list.map(t => t.id === activeTeam.id ? { ...t, members: next } : t) };
    setTeamsState(newState);
    saveTeams(newState);
  };

  const totalCount = filteredIds ? filteredIds.length : index.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <span>Rotomdex</span>
        </div>
        <div className="search-wrap">
          <input
            type="search"
            placeholder={i18n.searchPlaceholder}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <button
          className="tab-btn"
          aria-current={view === 'catalog'}
          onClick={() => setView('catalog')}
        >{i18n.catalog}</button>
        <button
          className="tab-btn"
          aria-current={view === 'team'}
          onClick={() => setView('team')}
        >
          {i18n.team}
          <span className="badge">{activeTeam.members.length}/6</span>
        </button>
      </header>

      {view === 'catalog' && (
        <>
          <WelcomeBanner />
          <FilterBar filters={filters} setFilters={setFilters} lang={lang} />
          <div className="grid">
            {items.map(it => (
              <CritterCard
                key={it.id}
                basic={it}
                inTeam={inTeamIds.has(it.id)}
                onOpen={(id) => setOpenId(id)}
                onToggleTeam={toggleInTeam}
                lang={lang}
              />
            ))}
            {items.length === 0 && !loading && filteredIds !== null && (
              <div className="empty">
                <h3>{i18n.noResults}</h3>
                <p>{i18n.tryRemoveFilter}</p>
              </div>
            )}
            {!done && (
              <div ref={sentinelRef} className="sentinel">
                {loading ? <div className="spinner" /> : <span style={{ opacity: 0.4 }}>{i18n.loadMore}</span>}
              </div>
            )}
            {done && items.length > 0 && (
              <div className="sentinel" style={{ opacity: 0.5 }}>
                {i18n.showingOf(items.length, totalCount)}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'team' && (
        <TeamView
          teamsState={teamsState}
          setTeamsState={setTeamsState}
          onOpenDetail={(id) => setOpenId(id)}
          onToast={onToast}
          lang={lang}
        />
      )}

      {openId && (
        <DetailModal
          id={openId}
          onClose={() => setOpenId(null)}
          onToggleTeam={(data) => toggleInTeam({ id: data.id, name: data.name, types: data.types, stats: data.stats })}
          inTeam={inTeamIds.has(openId)}
          openId={(id) => setOpenId(id)}
          lang={lang}
        />
      )}

      <TweaksUI tweaks={tweaks} setTweak={setTweak} i18n={i18n} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function TweaksUI({ tweaks, setTweak, i18n }) {
  return (
    <TweaksPanel title={i18n.tweaks.title}>
      <TweakSection label={i18n.tweaks.appearance} />
      <TweakRadio
        label={i18n.tweaks.theme}
        value={tweaks.theme}
        options={[{ value: 'light', label: i18n.tweaks.light }, { value: 'dark', label: i18n.tweaks.dark }]}
        onChange={(v) => setTweak('theme', v)}
      />
      <TweakRadio
        label={i18n.tweaks.density}
        value={tweaks.density}
        options={[
          { value: 'compact',     label: i18n.tweaks.compact },
          { value: 'comfortable', label: i18n.tweaks.normal },
          { value: 'spacious',    label: i18n.tweaks.spacious },
        ]}
        onChange={(v) => setTweak('density', v)}
      />
      <TweakColor
        label={i18n.tweaks.accent}
        value={tweaks.accent}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakSelect
        label={i18n.tweaks.language}
        value={tweaks.lang || 'es'}
        options={LANG_OPTIONS.map(l => ({ value: l.code, label: l.label }))}
        onChange={(v) => setTweak('lang', v)}
      />
    </TweaksPanel>
  );
}

function isLight(hex) {
  const c = hex.replace('#','');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0,2), 16);
  const g = parseInt(c.slice(2,4), 16);
  const b = parseInt(c.slice(4,6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

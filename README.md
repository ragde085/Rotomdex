# Rotomdex

Pokédex con la estética eléctrica de **Rotom**: catálogo y gestor de equipos en español, construido con **Vite + React 18** y datos de [PokéAPI](https://pokeapi.co/).

## Características

- **Catálogo** con scroll infinito (1025 entradas, paginado en lotes de 36).
- **Búsqueda** por número o por nombre en español o inglés.
- **Filtros** por tipo (combinables) y por generación (Kanto → Paldea).
- **Vista de detalle**: stats base, habilidades, debilidades/resistencias, movimientos destacados y cadena de evolución navegable.
- **Constructor de equipo**: hasta 6 miembros, drag-and-drop para reordenar, múltiples equipos con persistencia en `localStorage`, análisis de cobertura defensiva y debilidades compartidas.
- **Compartir equipo** vía URL (codifica IDs en el hash).
- **Tweaks panel** flotante: tema claro/oscuro, densidad y color de acento.
- **Banner de bienvenida** descartable con instrucciones rápidas.

## Stack

- React 18 + Vite 5
- ES modules (sin bundler externo, sin Babel-en-navegador)
- CSS plano con variables (sin framework)
- Datos vivos de PokéAPI (con caché en memoria por sesión)

## Estructura

```
.
├── index.html              # entry HTML de Vite
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx            # entry point: monta <App/>
    ├── App.jsx             # shell: topbar, búsqueda, scroll infinito, banner
    ├── components.jsx      # CritterCard, FilterBar, DetailModal
    ├── team.jsx            # TeamView + helpers de localStorage / share URL
    ├── tweaks-panel.jsx    # panel de tweaks reutilizable
    ├── data.js             # capa de datos: PokéAPI + traducciones ES + tipos
    └── styles.css          # estilos (tema claro/oscuro, tipos, layout)
```

## Comandos

```bash
npm install      # instala dependencias
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # build de producción → dist/
npm run preview  # sirve el build local para verificar
```

## Uso

1. Abre la app, busca una criatura por nombre o número, o filtra por tipo/generación.
2. Pulsa una carta para ver su detalle completo.
3. Pulsa **+** en cualquier carta para añadirla a tu equipo activo (máx. 6).
4. Cambia a **Mi Equipo** para reordenar miembros, ver cobertura defensiva y compartir el enlace.
5. Abre el panel de **Tweaks** para cambiar tema, densidad o acento.

## Licencia

MIT — ver [LICENSE](./LICENSE).

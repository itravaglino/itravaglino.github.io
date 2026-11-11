# Ignacio Travaglino

Sitio personal estático de [Ignacio Travaglino](https://github.com/itravaglino): coaching en inteligencia artificial y físico en Córdoba, Argentina. IA aplicada y sistemas autónomos.

Static personal site for Ignacio Travaglino: AI coaching and physicist in Córdoba, Argentina. Applied AI and autonomous systems.

El sitio es bilingüe (inglés en la primera visita; el interruptor ES/EN persiste en `localStorage`). No hay backend, cookies ni analítica.

The site is bilingual (English on a first visit; the ES/EN toggle is saved in `localStorage`). No backend, cookies, or analytics.

## Desarrollo local / Local development

Requiere Node.js 18+.

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147). La ruta del currículum es `/cv/`.

Then open [http://127.0.0.1:43147](http://127.0.0.1:43147). The résumé lives at `/cv/`.

```bash
npm run build    # emite dist/ listo para cualquier host estático
npm run preview  # sirve esa carpeta dist/
```

`npm run build` writes a deployable `dist/` folder. `npm run preview` serves it.

## Hospedaje gratis / Free hosting forever

Cualquier host de archivos estáticos sirve este proyecto. GitHub Pages y Cloudflare Pages son suficientes y gratuitos.

Any static file host works. GitHub Pages and Cloudflare Pages are enough, and free.

### GitHub Pages (Actions)

El flujo en `.github/workflows/pages.yml` construye `dist/` en cada push a `main` y publica con `actions/upload-pages-artifact` + `actions/deploy-pages`.

The workflow in `.github/workflows/pages.yml` builds `dist/` on every push to `main` and publishes with `actions/upload-pages-artifact` + `actions/deploy-pages`.

1. Subí el repositorio a GitHub (sitio de usuario `usuario.github.io` o un repo cualquiera).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. El primer push a `main` (o *Run workflow*) despliega el sitio.
4. Base del build: `'/'` (estilo sitio de usuario). Si el repo no es `usuario.github.io` y GitHub Pages queda en `usuario.github.io/nombre-del-repo/`, cambiá `base` en `vite.config.js` a `'/nombre-del-repo/'`.

Push the repo to GitHub (a user site `username.github.io`, or any repo). Enable **Settings → Pages → Source: GitHub Actions**. The first push to `main` (or *Run workflow*) deploys. Build base is `'/'` (user-site style). If Pages is served under `username.github.io/repo-name/`, set `base` in `vite.config.js` to `'/repo-name/'`.

`public/404.html` redirige al inicio.

### Cloudflare Pages

1. New project → conectar el mismo repositorio.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Node version: 18 o 22.

No hace falta adaptador: `dist/` es HTML, CSS y JS estáticos. `public/_headers` aporta cabeceras de seguridad en Cloudflare.

No adapter is required: `dist/` is plain static files. `public/_headers` adds security headers on Cloudflare.

### Dominio propio / Custom domain later

Hay un ejemplo comentado en `public/CNAME.example`. No copies un dominio inventado. Cuando tengas uno:

`public/CNAME.example` is a commented template. Do not invent a domain. When you have one:

1. Copiá el archivo a `public/CNAME` con una sola línea: tu dominio.
2. Configurá DNS según GitHub Pages o Cloudflare.
3. En GitHub: Settings → Pages → Custom domain.

Copy it to `public/CNAME` with a single line — your domain — then point DNS and set **Settings → Pages → Custom domain**.

## Currículum / CV

`/cv/` es un documento maquetado para pantalla e impresión. **Descargar / imprimir PDF** abre `window.print()`; el CSS de impresión está pensado para A4 y carta. No hay un PDF adjunto: el navegador puede *Guardar como PDF*.

`/cv/` is a designed résumé. **Download / Print PDF** calls `window.print()`. Print CSS targets A4 and Letter. There is no attached scan; use the browser’s Save as PDF.

## Juego de mercado / Market game

`/trader/` es un juego educativo con precios diarios reales de Yahoo Finance (cierre ajustado, archivo `data/market.json`). No es asesoramiento financiero. El idioma usa la misma clave `it-lang`.

`/trader/` is an educational game on real Yahoo Finance daily prices (split-adjusted close, file `data/market.json`). It is not financial advice. Language uses the same `it-lang` key.

**Daily Trade.** Cinco gráficos por día, la misma semilla para todos (fecha en `America/Argentina/Cordoba`). En cada uno: comprar, vender en corto o quedarse afuera, tamaño ×1–×3, stop y objetivo opcionales, y cuatro pasos de cinco sesiones para mantener, sumar, reducir o cerrar. SMA 20/50 y RSI 14 se pueden prender. El volumen no está en el archivo. Cada pista resta puntos y solo describe el tramo visible.

**Daily Trade.** Five charts a day, the same seed for everyone (the date in `America/Argentina/Cordoba`). On each: buy, short, or stay out, size ×1–×3, optional stop and target, then four steps of five sessions to hold, add, reduce, or close. SMA 20/50 and RSI 14 can be turned on. Volume is not in the file. Each hint costs points and only describes the visible stretch.

**Puntaje.** Resultado ajustado por riesgo = tamaño × retorno ejecutado / (1 + peor cierre en contra) × 1000. Dirección +150 si es positivo. Disciplina +80 si un stop cierra la operación, si no +40 si el stop se mantuvo; sin stop y un cierre en contra peor que 8%, −40. Tiempo +50 si la primera decisión tarda 20 segundos o menos. Pista −120. Si el subtotal es positivo, × (1 + 0.05 × gráficos ganados antes en la sesión, tope 5). El día es la suma. El panel «Cómo se puntúa» repite esta fórmula. El portafolio es `1000 × (retorno propio − S&P 500) / (1 + volatilidad) − 500 × |peor caída|`, más 30 al rebalancear con un desvío ≥ 10 puntos y −10 si el desvío es < 5.

**Score.** Risk-adjusted result = size × filled return / (1 + worst close against you) × 1000. Direction +150 if that is positive. Discipline +80 if a stop closes the trade, otherwise +40 if a stop was set and held; with no stop and a close worse than 8% against you, −40. Time +50 if the first decision takes 20 seconds or less. Hint −120. A positive subtotal is multiplied by (1 + 0.05 × prior winning charts this session, cap 5). The day is the sum. The “How scoring works” panel states this formula. Portfolio score is `1000 × (your return − S&P 500) / (1 + volatility) − 500 × |worst drawdown|`, plus 30 for rebalancing a drift of at least 10 points and −10 when the drift is under 5.

Los stops se evalúan en el cierre diario. Si el cierre salta el stop, la ejecución es al precio del stop y el hueco igual entra en la excursión adversa. Stop y objetivo en el mismo cierre: gana el stop.

Stops are judged on the daily close. If the close gaps through the stop, the fill is the stop price and the gap still counts as adverse. A stop and a target on the same close: the stop fills.

### Tabla de posiciones / Leaderboard

Si el puntaje entra en el top 10 de Hoy (sesión diaria) o Histórico (mejor portafolio), la página pide un nombre de hasta 20 caracteres.

If a score would enter the top 10 for Today (daily session) or All-time (portfolio), the page asks for a name of up to 20 characters.

La URL y la clave publicable del proyecto están en `.env.production` y en `src/trader-supabase.js`. El build de Vite las incluye. El cliente llama `get_top10` y `submit_score` con el header `apikey`. Si esas funciones todavía no existen, muestra la lista de este navegador y lo dice.

The project URL and publishable key live in `.env.production` and `src/trader-supabase.js`. The Vite build embeds them. The client calls `get_top10` and `submit_score` with the `apikey` header. If those functions are not there yet, it shows this browser’s list and says so.

Hay que aplicar `supabase/migrations/001_leaderboard.sql` en Supabase una vez. `anon` puede leer `scores` y no puede insertar, actualizar ni borrar. `submit_score` es `SECURITY DEFINER` con `search_path = public`: valida el nombre, los límites del puntaje, que el día sea hoy en Córdoba, un envío por modo por día por id de cliente, y que el puntaje entre al top 10. `get_top10(mode, day)` devuelve el ranking. Solo `anon` tiene `execute` en esas dos funciones.

Apply `supabase/migrations/001_leaderboard.sql` in Supabase once. `anon` can read `scores` and cannot insert, update, or delete. `submit_score` is `SECURITY DEFINER` with `search_path = public`: it checks the name, the score bounds, that the day is today in Córdoba, one submission per mode per day per client id, and that the score would make the top 10. `get_top10(mode, day)` returns the ranking. Only `anon` can `execute` those two functions.

## Taller de Git / Git workshop

`/github/` es un juego para aprender Git y GitHub: terminal simulada, grafo de commits y siete misiones (repositorio, commit, historia, ramas, merge con conflicto, remoto y pull request). El progreso queda en `localStorage` (`it-git-game`), aparte del idioma (`it-lang`).

`/github/` is a game for learning Git and GitHub: a simulated terminal, a commit graph, and seven missions (repository, commit, history, branches, merge with a conflict, remotes, and a pull request). Progress is stored in `localStorage` (`it-git-game`), separate from the language (`it-lang`).

## Contenido

Solo hechos aportados por Ignacio. Sin retrato, métricas inventadas ni menciones a empleadores a los que pudiera estar postulando.

Copy is limited to facts Ignacio provided. No portrait, no invented metrics, no prospective-employer names.

## Estructura

```
index.html          página principal
cv/index.html       currículum
github/index.html   taller de Git y GitHub
src/                estilos, i18n, entradas JS, simulador git
public/             favicon, OG, robots.txt, 404, CNAME.example
.github/workflows   despliegue a GitHub Pages
```

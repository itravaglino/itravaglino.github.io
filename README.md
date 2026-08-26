# Ignacio Travaglino

Sitio personal estático de [Ignacio Travaglino](https://github.com/itravaglino): desarrollador general y físico en Córdoba, Argentina. IA aplicada y sistemas autónomos.

Static personal site for Ignacio Travaglino: general developer and physicist in Córdoba, Argentina. Applied AI and autonomous systems.

El sitio es bilingüe (ES por defecto, EN con un interruptor que persiste en `localStorage`). No hay backend, cookies ni analítica.

The site is bilingual (Spanish by default; English via a toggle persisted in `localStorage`). No backend, cookies, or analytics.

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

## Contenido

Solo hechos aportados por Ignacio. Sin retrato, métricas inventadas ni menciones a empleadores a los que pudiera estar postulando.

Copy is limited to facts Ignacio provided. No portrait, no invented metrics, no prospective-employer names.

## Estructura

```
index.html          página principal
cv/index.html       currículum
src/                estilos, i18n, entradas JS
public/             favicon, OG, robots.txt, 404, CNAME.example
.github/workflows   despliegue a GitHub Pages
```

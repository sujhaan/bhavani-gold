# Bhavani Gold — website

Landing page and 3D jewellery studio for Bhavani Gold, Jenda Street, Vijayawada.

## Hosting (free)
Hosted on Cloudflare Pages (free plan): every push to `main` rebuilds and publishes the site automatically.

Cloudflare Pages build settings:
- Framework preset: **Vite** (or None)
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`

## Where to change things
- Shop details (phone, address, hours, Instagram): `src/site/site.ts`
- Journal / blog posts: `src/site/journal.ts`
- Page sections: `src/site/Landing.tsx`
- Photos: `public/photos/`
- 3D designs: `src/engine/templates.ts` and `src/site/designer.ts`

## Run locally
```
npm install
npm run dev
```

# Direct Links — MongoDB File Sharing

## Project structure
- `index.html` — password-protected Direct Links page and File Sharing UI
- `api/app.js` — Express API + MongoDB GridFS file storage
- `api/index.js` — Vercel serverless entry point
- `server.js` — local Node/Express entry point
- `vercel.json` — minimal Vercel configuration

## Vercel Environment Variables
Set these in Vercel Project Settings → Environment Variables:
- `MONGODB_URI` — your MongoDB connection string
- `MONGODB_DB` — `direct_links`
- `PAGE_PASSWORD` — your page password
- `AUTH_SECRET` — a long random secret

Do not commit `.env`.

## MongoDB storage
Files are stored in MongoDB GridFS in the `uploads.files` and `uploads.chunks` collections.

## Deployment
The GitHub repository root must contain `index.html`, `package.json`, `vercel.json`, and the `api/` folder.
Keep Vercel Root Directory at the repository root. Do not set a custom Output Directory.
After pushing changes, create a fresh Vercel deployment from the latest commit.

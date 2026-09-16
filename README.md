# Direct Links + MongoDB File Sharing

This project keeps uploaded file bytes and file metadata in MongoDB GridFS. No local `uploads/` folder is used.

## Environment variables

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.example.mongodb.net/?appName=Cluster0
MONGODB_DB=direct_links
PAGE_PASSWORD=deoxy
AUTH_SECRET=replace-with-a-long-random-secret
```

The File Sharing feature uses the `uploads.files` and `uploads.chunks` GridFS collections. It can reuse an existing MongoDB cluster/database; it does not overwrite unrelated collections.

## Local

```bash
npm install
npm start
```

## Vercel

Add the environment variables in the Vercel project settings and deploy.

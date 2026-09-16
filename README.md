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


## Vercel deployment
Keep the files at the repository root. Required Vercel Environment Variables:
- MONGODB_URI
- MONGODB_DB=direct_links
- AUTH_SECRET

`deoxy` is accepted as the page password by the server. If `PAGE_PASSWORD` is set in Vercel, that configured password is also accepted.


## Folder upload
The File Sharing UI now includes **Upload Folder**. On supported browsers, selecting a folder uploads all files in one operation and automatically creates the same subfolder structure inside the currently open folder. Multiple individual files can also be selected with **Upload Files**.

Uploads continue to use the existing 3 MB chunked endpoint, so large videos/files do not have an application-level size limit. Empty folders are not created because browsers generally do not include empty directories in folder selections.

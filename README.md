# Direct Links + This PC Style File Sharing

A small Express + MongoDB GridFS app with a password-protected page and a virtual file drive.

## File Sharing features
- Create unlimited folders and nested folders.
- Optional password for every folder.
- Passwords are stored as scrypt hashes; plaintext folder passwords are not stored.
- Locked folders require their own password before files can be listed, uploaded, downloaded or deleted.
- Upload/download/delete files in each folder.
- Existing GridFS files without `metadata.folderId` remain in **This PC** (root).
- Delete a folder recursively, including files stored inside it.
- Responsive UI styled like a simple Windows **This PC** drive/folder view.

## Environment variables
Create `.env` locally or set these in Vercel:

```text
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=direct_links
PAGE_PASSWORD=deoxy
AUTH_SECRET=replace-with-a-long-random-secret
```

Never commit `.env` or expose your MongoDB connection string.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

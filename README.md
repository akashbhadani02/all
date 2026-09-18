# WebOS + Link Manager + Shared Drive

This package combines the Windows-style WebOS desktop with the existing Link/Admin/File Sharing backend.

## Run locally
1. Install Node.js.
2. Open this folder in PowerShell/CMD.
3. Run `npm install`.
4. Set the MongoDB connection and secrets in `.env` as required by the existing backend.
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Desktop apps added
- Main Admin: edit page/file-sharing/admin passwords, all project links and folder passwords.
- My Links: all backend links with protected-link login.
- Shared Drive: password-protected MongoDB/GridFS Drive, folders, folder passwords, upload files/folders, preview and download.

The original backend files/API routes are retained.

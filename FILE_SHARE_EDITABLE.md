# Editable File Share

The File Sharing section now supports:

- Edit and save text/code files: TXT, MD, JSON, JS, TS, CSS, HTML, XML, SVG, CSV, YAML, SQL, Python, Java, C/C++, PHP, etc.
- Rename files.
- Change file path by moving a file to another folder or root.
- Replace any binary/media file while keeping the original filename; the old file remains recoverable in the Media folder.
- Rename folders.
- Change folder path by moving folders, with descendant/cycle protection.
- Protected folders continue to require their password when accessed or used as a target.
- Large uploads continue using the existing chunked upload system.

### Path editing

Use the `📍 Path` button on a file or folder. Select `Root` or another available folder.

### Text editing

Use `✏️ Edit` on a supported text/code file. Edit the content and press `Save Changes`.

### Binary/media editing

Binary files cannot be edited as text safely. Use `♻️ Replace` to upload a replacement file. The previous version is retained in the protected Media folder.

### Deployment

Run:

```bash
npm install
npm start
```

For Vercel, keep the existing `vercel.json` and configure the required environment variables (`MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, passwords, etc.) in the deployment settings.

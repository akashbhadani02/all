# File Share — Editable File Manager

This build adds a proper file-manager UI and editing controls.

## File operations
- Upload single/multiple files
- Upload folders while preserving subfolders
- Create folders
- Open folders
- Rename files and folders
- Change file/folder path (move)
- Replace any file while retaining the previous copy in Media/recovery
- Preview images, video, audio and PDF/text files
- Download and delete
- Search files/folders

## Editing
Text/code files can be opened with **Edit** or by double-clicking them. Supported examples include:
TXT, MD, JSON, CSV, XML, HTML, CSS, JS, TS, JSX, TSX, YAML, YML, SQL, SH, BAT, CMD, PS1, PY, JAVA, C, CPP, H, HPP, PHP, RB, GO, RS, SWIFT, KT, DART, VUE and SVELTE.

The editor supports:
- UTF-8 text editing
- Ctrl+S / Cmd+S save
- Unsaved-change warning
- Tab inserts two spaces
- 8 MB browser editing limit

Binary files such as images, videos, PDFs and ZIPs are not directly text-editable. They can be previewed where supported or replaced with a new file.

## Important
The Git repository itself is not included in the deployment ZIP. This avoids carrying `.git` merge-conflict files into deployment.

Run:

```bash
npm install
npm start
```

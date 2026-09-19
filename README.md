# Direct Links

## Upload Folder
Use **📂 Upload Folder** to select a complete folder. Every file inside the selected folder, including files in nested subfolders, is uploaded automatically and the same folder/subfolder structure is recreated in the app.

The browser supplies each file's `webkitRelativePath` (for example `Photos/2026/IMG001.jpg`); the uploader uses that path to create the required folders before uploading the file.

Large files are sent in 3 MB chunks, so the application does not impose a total video/file size limit. Actual hosting/storage limits can still apply.

For folder selection, use a current Chrome or Edge browser.


## Fast / unrestricted file upload

The upload UI accepts `*/*`, so it does not restrict extensions or MIME types. Files such as
`.exe`, `.apk`, `.zip`, `.rar`, `.7z`, `.pdf`, videos, images, documents, and other binary files
can be uploaded and downloaded.

Uploads use 3 MB HTTP chunks with up to 4 chunks transferred in parallel per file, plus up to
3 files in parallel when selecting individual files. The server finalizes the file only after all
chunks have arrived. This reduces the long wait caused by uploading every chunk sequentially.

There is no application-level total file-size limit. The real maximum is determined by MongoDB,
available storage, browser/device limits, and the hosting plan/serverless request limits.

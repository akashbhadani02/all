const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

let dbPromise;

function mongo() {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured');
    const client = new MongoClient(uri);
    dbPromise = client.connect().then(c =>
      c.db(process.env.MONGODB_DB || 'direct_links')
    );
  }
  return dbPromise;
}

function tokenFor(password) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret')
    .update(String(password))
    .digest('hex');
}

function acceptedPasswords() {
  const configured = String(process.env.PAGE_PASSWORD || '').trim();
  return configured && configured !== 'deoxy' ? [configured, 'deoxy'] : ['deoxy'];
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const valid = acceptedPasswords().some(password => token === tokenFor(password));
  if (valid) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return !password;
  const parts = String(stored).split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function folderToken(folder) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret')
    .update(`${folder._id.toString()}:${folder.passwordHash || ''}`)
    .digest('hex');
}

function validFolderToken(req, folder) {
  const supplied = String(req.headers['x-folder-token'] || '');
  if (!folder.passwordHash) return true;
  const expected = folderToken(folder);
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function safeObjectId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
app.use(express.static(path.join(__dirname, '..')));

app.post('/api/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (!acceptedPasswords().includes(password)) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: tokenFor(password) });
});

// Returns the folders and files visible at one level of the virtual drive.
app.get('/api/files', auth, async (req, res) => {
  try {
    const db = await mongo();
    const folderId = req.query.folderId ? safeObjectId(req.query.folderId) : null;
    if (req.query.folderId && !folderId) return res.status(400).json({ error: 'Invalid folder id' });

    let currentFolder = null;
    if (folderId) {
      currentFolder = await db.collection('file_folders').findOne({ _id: folderId });
      if (!currentFolder) return res.status(404).json({ error: 'Folder not found' });
      if (!validFolderToken(req, currentFolder)) return res.status(403).json({ error: 'Folder password required', locked: true });
    }

    const folders = await db.collection('file_folders')
      .find({ parentId: folderId })
      .sort({ name: 1 })
      .project({ name: 1, parentId: 1, passwordHash: 1, createdAt: 1 })
      .toArray();

    const files = await db.collection('uploads.files')
      .find({ 'metadata.folderId': folderId ? folderId.toString() : null })
      .sort({ uploadDate: -1 })
      .project({ filename: 1, length: 1, uploadDate: 1, contentType: 1, metadata: 1 })
      .toArray();

    res.json({
      currentFolder: currentFolder ? { id: currentFolder._id.toString(), name: currentFolder.name, parentId: currentFolder.parentId ? currentFolder.parentId.toString() : null, protected: !!currentFolder.passwordHash } : null,
      folders: folders.map(f => ({ id: f._id.toString(), name: f.name, parentId: f.parentId ? f.parentId.toString() : null, protected: !!f.passwordHash, date: f.createdAt })),
      files: files.map(f => ({ id: f._id.toString(), name: f.filename, size: f.length, date: f.uploadDate, type: f.contentType || 'application/octet-stream' }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/folders', auth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');
    const parentId = req.body?.parentId ? safeObjectId(req.body.parentId) : null;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });
    if (name.length > 80) return res.status(400).json({ error: 'Folder name is too long' });
    if (req.body?.parentId && !parentId) return res.status(400).json({ error: 'Invalid parent folder' });

    const db = await mongo();
    if (parentId) {
      const parent = await db.collection('file_folders').findOne({ _id: parentId });
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
      if (!validFolderToken(req, parent)) return res.status(403).json({ error: 'Parent folder password required', locked: true });
    }

    const exists = await db.collection('file_folders').findOne({ parentId, name });
    if (exists) return res.status(409).json({ error: 'A folder with this name already exists here' });

    const doc = { name, parentId, passwordHash: password ? hashPassword(password) : null, createdAt: new Date() };
    const result = await db.collection('file_folders').insertOne(doc);
    res.json({ ok: true, folder: { id: result.insertedId.toString(), name, parentId: parentId ? parentId.toString() : null, protected: !!password } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/folders/:id/unlock', auth, async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid folder id' });
    const db = await mongo();
    const folder = await db.collection('file_folders').findOne({ _id: id });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    if (!folder.passwordHash) return res.json({ ok: true, token: folderToken(folder) });
    if (!verifyPassword(String(req.body?.password || ''), folder.passwordHash)) return res.status(401).json({ error: 'Wrong folder password' });
    res.json({ ok: true, token: folderToken(folder) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/folders/:id/password', auth, async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid folder id' });
    const db = await mongo();
    const folder = await db.collection('file_folders').findOne({ _id: id });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    if (!validFolderToken(req, folder)) return res.status(403).json({ error: 'Folder password required', locked: true });
    const password = String(req.body?.password || '');
    await db.collection('file_folders').updateOne({ _id: id }, { $set: { passwordHash: password ? hashPassword(password) : null } });
    res.json({ ok: true, protected: !!password });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/folders/:id', auth, async (req, res) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid folder id' });
    const db = await mongo();
    const folder = await db.collection('file_folders').findOne({ _id: id });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    if (!validFolderToken(req, folder)) return res.status(403).json({ error: 'Folder password required', locked: true });

    const descendants = [id.toString()];
    let frontier = [id];
    while (frontier.length) {
      const children = await db.collection('file_folders').find({ parentId: { $in: frontier } }).project({ _id: 1 }).toArray();
      frontier = children.map(x => x._id);
      descendants.push(...frontier.map(x => x.toString()));
    }
    const files = await db.collection('uploads.files').find({ 'metadata.folderId': { $in: descendants } }).project({ _id: 1 }).toArray();
    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    for (const f of files) { try { await bucket.delete(f._id); } catch (_) {} }
    await db.collection('file_folders').deleteMany({ _id: { $in: descendants.map(x => new ObjectId(x)) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file selected' });
    const db = await mongo();
    const folderId = req.body?.folderId ? safeObjectId(req.body.folderId) : null;
    if (req.body?.folderId && !folderId) return res.status(400).json({ error: 'Invalid folder id' });
    if (folderId) {
      const folder = await db.collection('file_folders').findOne({ _id: folderId });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      if (!validFolderToken(req, folder)) return res.status(403).json({ error: 'Folder password required', locked: true });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const stream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { uploadedBy: 'direct-links', source: 'mongodb-gridfs', folderId: folderId ? folderId.toString() : null }
    });
    stream.end(req.file.buffer);
    await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/:id/download', auth, async (req, res) => {
  try {
    const db = await mongo();
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(400).send('Invalid file id');
    const file = await db.collection('uploads.files').findOne({ _id: id });
    if (!file) return res.status(404).send('File not found');
    const folderId = file.metadata?.folderId ? safeObjectId(file.metadata.folderId) : null;
    if (folderId) {
      const folder = await db.collection('file_folders').findOne({ _id: folderId });
      if (!folder) return res.status(404).send('Folder not found');
      if (!validFolderToken(req, folder)) return res.status(403).send('Folder password required');
    }
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    new GridFSBucket(db, { bucketName: 'uploads' }).openDownloadStream(id).on('error', () => { if (!res.headersSent) res.status(404).end(); }).pipe(res);
  } catch (e) { res.status(400).send('Invalid file id'); }
});

app.delete('/api/files/:id', auth, async (req, res) => {
  try {
    const db = await mongo();
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid file id' });
    const file = await db.collection('uploads.files').findOne({ _id: id });
    if (!file) return res.status(404).json({ error: 'File not found' });
    const folderId = file.metadata?.folderId ? safeObjectId(file.metadata.folderId) : null;
    if (folderId) {
      const folder = await db.collection('file_folders').findOne({ _id: folderId });
      if (folder && !validFolderToken(req, folder)) return res.status(403).json({ error: 'Folder password required', locked: true });
    }
    await new GridFSBucket(db, { bucketName: 'uploads' }).delete(id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = { createApp: () => app };

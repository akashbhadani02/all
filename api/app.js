const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
let dbPromise;

function mongo() {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured');
    const client = new MongoClient(uri);
    dbPromise = client.connect().then(c => c.db(process.env.MONGODB_DB || 'direct_links'));
  }
  return dbPromise;
}
function tokenFor(password) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update(password).digest('hex');
}
function auth(req, res, next) {
  const expected = tokenFor(process.env.PAGE_PASSWORD || 'deoxy');
  if (req.headers.authorization === `Bearer ${expected}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.post('/api/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (password !== (process.env.PAGE_PASSWORD || 'deoxy')) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: tokenFor(password) });
});

app.get('/api/files', auth, async (req, res) => {
  try {
    const db = await mongo();
    const files = await db.collection('uploads.files').find({}).sort({ uploadDate: -1 }).project({ filename:1,length:1,uploadDate:1,contentType:1,metadata:1 }).toArray();
    res.json(files.map(f => ({ id: f._id.toString(), name:f.filename, size:f.length, date:f.uploadDate, type:f.contentType || 'application/octet-stream' })));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/files', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({error:'No file selected'});
    const db = await mongo();
    const bucket = new GridFSBucket(db, { bucketName:'uploads' });
    const stream = bucket.openUploadStream(req.file.originalname, { contentType:req.file.mimetype, metadata:{ uploadedBy:'direct-links', source:'mongodb-gridfs' } });
    stream.end(req.file.buffer);
    await new Promise((resolve,reject)=>{ stream.on('finish',resolve); stream.on('error',reject); });
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/files/:id/download', auth, async (req,res) => {
  try {
    const db = await mongo();
    const id = new ObjectId(req.params.id);
    const file = await db.collection('uploads.files').findOne({_id:id});
    if (!file) return res.status(404).send('File not found');
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    new GridFSBucket(db,{bucketName:'uploads'}).openDownloadStream(id).pipe(res);
  } catch(e) { res.status(400).send('Invalid file id'); }
});

app.delete('/api/files/:id', auth, async (req,res) => {
  try {
    const db = await mongo();
    const id = new ObjectId(req.params.id);
    await new GridFSBucket(db,{bucketName:'uploads'}).delete(id);
    res.json({ok:true});
  } catch(e) { res.status(400).json({error:e.message}); }
});

module.exports = { createApp: () => app };

const express = require('express'), path = require('path'), multer = require('multer'), crypto = require('crypto'), fs = require('fs');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const app = express(), upload = multer({ limits: { files: 1 }, storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, '/tmp'), filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + '-' + Date.now()) }) });
let dbPromise;
function mongo() {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw Error('MONGODB_URI is not configured');
    const c = new MongoClient(uri);
    dbPromise = c.connect().then(async x => {
      const db = x.db(process.env.MONGODB_DB || 'direct_links');
      // Keep unfinished uploads from occupying storage forever.
      const chunks = db.collection('upload_chunks');
      await chunks.createIndex({ uploadId: 1, index: 1 }, { unique: true });
      await chunks.createIndex({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
      return db;
    });
  }
  return dbPromise;
}
function tokenFor(p) { return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update(String(p)).digest('hex'); }
function adminToken(p) { return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update('admin:' + String(p)).digest('hex'); }
async function getSettings() {
 const db=await mongo(); const c=db.collection('app_settings');
 let d=await c.findOne({_id:'passwords'});
 if(!d){ d={_id:'passwords', pagePassword:String(process.env.PAGE_PASSWORD || 'deoxy'), fileSharePassword:String(process.env.FILE_SHARE_PASSWORD || '@'), adminPassword:String(process.env.ADMIN_PASSWORD || 'admin')}; await c.insertOne(d); }
 return d;
}

// Dedicated admin media folder.
// All existing image/video/audio files are moved here when the admin opens it.
// New media uploaded at the root is automatically stored here as well.
async function ensureAdminMediaFolder(db) {
  let f = await db.collection('folders').findOne({ name: 'Media', parentId: null });
  if (!f) {
    const r = await db.collection('folders').insertOne({
      name: 'Media',
      parentId: null,
      password: 'media',
      adminOnly: true,
      createdAt: new Date()
    });
    f = { _id: r.insertedId, name: 'Media', parentId: null, password: 'media', adminOnly: true };
  } else {
    await db.collection('folders').updateOne(
      { _id: f._id },
      { $set: { password: 'media', adminOnly: true, updatedAt: new Date() }, $unset: { passwordHash: '', passwordSalt: '' } }
    );
    f.password = 'media';
    f.adminOnly = true;
  }

  const mediaTypes = /^(image|video|audio)\//i;
  const mediaFiles = await db.collection('uploads.files')
    .find({ contentType: { $regex: mediaTypes } })
    .project({ _id: 1, 'metadata.folderId': 1 })
    .toArray();

  const folderId = f._id.toString();
  if (mediaFiles.length) {
    const ids = mediaFiles.map(x => x._id);
    await db.collection('uploads.files').updateMany(
      { _id: { $in: ids } },
      { $set: { 'metadata.folderId': folderId, 'metadata.adminMediaFolder': true } }
    );
  }
  return { ...f, movedFiles: mediaFiles.length };
}

const DEFAULT_LINKS = [
 {id:'my-cv',name:'My CV',url:'https://akashbhadani02.github.io/Akash-bhadani/',icon:'👤',password:'',protected:false},
 {id:'aducate-app',name:'Aducate App',url:'https://www.aducate.online',icon:'🎓',password:'',protected:false},
 {id:'tectrum',name:'Tectrum',url:'https://tectrum.vercel.app',icon:'💻',password:'',protected:false},
 {id:'iot',name:'IOT',url:'https://akashhome.vercel.app',icon:'🏠',password:'',protected:false},
 {id:'fees',name:'Fees',url:'https://akashstudent.vercel.app',icon:'💰',password:'',protected:false},
 {id:'my-whatsapp',name:'My Whatsapp',url:'https://mywhat.vercel.app',icon:'💬',password:'',protected:false},
 {id:'family-tree',name:'My Family Tree',url:'https://bhadaniparivar.vercel.app',icon:'🌳',password:'',protected:false},
 {id:'student-report',name:'Student Report',url:'https://student-report-lake.vercel.app/',icon:'📊',password:'',protected:false},
 {id:'english-tutor',name:'English Tutor',url:'https://akashtutor.vercel.app/',icon:'🗣️',password:'',protected:false},
 {id:'paper',name:'Paper',url:'https://papers-nu.vercel.app/',icon:'📚',password:'',protected:false},
 {id:'coin-note',name:'Coin and Note',url:'https://sjbhadanicoin.vercel.app/',icon:'🪙',password:'',protected:false},
 {id:'earn',name:'Earn',url:'https://new-earn-drab.vercel.app/',icon:'💵',password:'',protected:false},
 {id:'meeting-office',name:'Meeting Office Aducate',url:'https://spoken-english-meeting.vercel.app/index.html',icon:'🎥',password:'',protected:false},
 {id:'mix-meeting',name:'Mix Meeting',url:'https://zoom-meeting-app-aup6.onrender.com/',icon:'📹',password:'',protected:false},
 {id:'aducate-website',name:'Aducate Website',url:'https://akashbhadani02.github.io/Aducate_English',icon:'🌐',password:'',protected:false},
 {id:'old-student',name:'Old Student Maruti',url:'https://akashbhadani02.github.io/attendance/',icon:'📝',password:'',protected:false},
 {id:'akinator',name:'Akinator',url:'https://akinator-theta.vercel.app/',icon:'🎮',password:'',protected:false}
];
async function getLinks(){
 const db=await mongo(); const c=db.collection('app_settings'); let d=await c.findOne({_id:'links'});
 if(!d){ d={_id:'links',links:DEFAULT_LINKS}; await c.insertOne(d); return DEFAULT_LINKS; }
 return Array.isArray(d.links)?d.links:DEFAULT_LINKS;
}
function linkToken(id,pass){ return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update('link:'+String(id)+':'+String(pass)).digest('hex'); }
async function fileShareTokenValue(pass) { return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update('file-share:' + String(pass)).digest('hex'); }
async function fileAuth(req, res, next) { try { const t=getAuthToken(req), d=await getSettings(), expected=await fileShareTokenValue(d.fileSharePassword); if(t){const a=Buffer.from(t),b=Buffer.from(expected);if(a.length===b.length&&crypto.timingSafeEqual(a,b))return next();} res.status(401).json({error:'File Sharing password required'}); } catch(e){res.status(500).json({error:e.message});} }
async function acceptedPasswords() { const d=await getSettings(); return [String(d.pagePassword)]; }
function getAuthToken(req) { const h = req.headers.authorization || '', t = h.startsWith('Bearer ') ? h.slice(7) : ''; return t || String(req.query?.token || ''); }
async function auth(req, res, next) { try { const t=getAuthToken(req), ps=await acceptedPasswords(); if(ps.some(p=>t===tokenFor(p))) return next(); res.status(401).json({error:'Unauthorized'}); } catch(e){res.status(500).json({error:e.message});} }
function folderToken(id) { return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'change-this-secret').update('folder:' + id).digest('hex'); }
function folderUnlocked(req, id) { return (req.headers['x-folder-token'] || req.query?.folderToken) === folderToken(id); }
function hashPass(p) { const salt = crypto.randomBytes(16).toString('hex'), hash = crypto.scryptSync(p, salt, 64).toString('hex'); return { salt, hash }; }
function verifyPass(p, s, h) { try { const x = crypto.scryptSync(p, s, 64); return crypto.timingSafeEqual(x, Buffer.from(h, 'hex')); } catch { return false; } }
// Folder passwords are intentionally stored in plain text because the owner requested admin-side recovery/viewing.
function setFolderPassword(d, pass) { if (pass) { d.password = pass; d.passwordHash = undefined; d.passwordSalt = undefined; } return d; }
function folderPasswordMatches(f, p) { return String(f.password || '') === String(p || '') || (!f.password && f.passwordHash && verifyPass(String(p || ''), f.passwordSalt, f.passwordHash)); }
function oid(id) { return ObjectId.isValid(id) ? new ObjectId(id) : null; }
app.use(express.json({ limit: '1mb' })); app.get('/', (q, s) => s.sendFile(path.join(__dirname, '..', 'index.html'))); app.use(express.static(path.join(__dirname, '..')));
app.post('/api/login', async (q,s)=>{try{const p=String(q.body?.password||''),d=await getSettings();if(p!==String(d.pagePassword))return s.status(401).json({error:'Wrong password'});s.json({token:tokenFor(p)});}catch(e){s.status(500).json({error:e.message});}});
app.post('/api/file-share-login', async (q,s)=>{try{const p=String(q.body?.password||''),d=await getSettings();if(p!==String(d.fileSharePassword))return s.status(401).json({error:'Wrong File Sharing password'});s.json({token:await fileShareTokenValue(p)});}catch(e){s.status(500).json({error:e.message});}});
app.post('/api/admin-login', async(q,s)=>{try{const p=String(q.body?.password||''),d=await getSettings();if(p!==String(d.adminPassword))return s.status(401).json({error:'Wrong admin password'});s.json({token:adminToken(p)});}catch(e){s.status(500).json({error:e.message});}});
async function adminAuth(req,res,next){try{const t=getAuthToken(req),d=await getSettings();if(t===adminToken(d.adminPassword))return next();res.status(401).json({error:'Admin access required'});}catch(e){res.status(500).json({error:e.message});}}
app.post('/api/admin/media-folder', adminAuth, async(q,s)=>{
  try {
    const db=await mongo(), d=await getSettings(), f=await ensureAdminMediaFolder(db);
    const fileToken=await fileShareTokenValue(d.fileSharePassword);
    const folderAccessToken=folderToken(f._id.toString());
    s.json({ok:true,folder:{id:f._id.toString(),name:'Media',password:'media',movedFiles:f.movedFiles},fileToken,folderToken:folderAccessToken});
  } catch(e) { s.status(500).json({error:e.message}); }
});
app.get('/api/admin/passwords',adminAuth,async(q,s)=>{try{const d=await getSettings();const db=await mongo();const folders=await db.collection('folders').find({}).sort({name:1}).toArray();const links=await getLinks();s.json({pagePassword:String(d.pagePassword),fileSharePassword:String(d.fileSharePassword),adminPassword:String(d.adminPassword),links,folders:folders.map(f=>({id:f._id.toString(),name:f.name,password:String(f.password||''),protected:!!(f.password||f.passwordHash),adminOnly:!!f.adminOnly}))});}catch(e){s.status(500).json({error:e.message});}});
app.put('/api/admin/passwords',adminAuth,async(q,s)=>{try{const db=await mongo(),d=await getSettings(),b=q.body||{};const pagePassword=String(b.pagePassword??d.pagePassword),fileSharePassword=String(b.fileSharePassword??d.fileSharePassword),adminPassword=String(b.adminPassword??d.adminPassword);if(!pagePassword||!fileSharePassword||!adminPassword)return s.status(400).json({error:'Passwords cannot be empty'});await db.collection('app_settings').updateOne({_id:'passwords'},{$set:{pagePassword,fileSharePassword,adminPassword,updatedAt:new Date()}},{upsert:true});if(Array.isArray(b.folders)){for(const f of b.folders){if(!f||!f.id)continue;const id=oid(f.id);if(!id)continue;const pass=String(f.password||'');if(pass)await db.collection('folders').updateOne({_id:id},{$set:{password:pass},$unset:{passwordHash:'',passwordSalt:''}});else await db.collection('folders').updateOne({_id:id},{$unset:{password:'',passwordHash:'',passwordSalt:''}});}}if(Array.isArray(b.links)){const clean=b.links.map((x,i)=>({id:String(x.id||('link-'+i)),name:String(x.name||'Link'),url:String(x.url||''),icon:String(x.icon||'🔗'),password:String(x.password||''),protected:Boolean(x.protected)}));if(clean.some(x=>!x.url||!/^https?:\/\//i.test(x.url)))return s.status(400).json({error:'Every link must have a valid http/https URL'});await db.collection('app_settings').updateOne({_id:'links'},{$set:{links:clean,updatedAt:new Date()}},{upsert:true});}s.json({ok:true});}catch(e){s.status(500).json({error:e.message});}});


app.get('/api/links',async(q,s)=>{
 try {
   const links=await getLinks();
   s.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
   s.json(links);
 } catch(e) {
   // Public links should still render if the database is temporarily unavailable.
   // Admin/file features continue to require MongoDB, but the landing links use the
   // built-in defaults so a transient DB problem does not produce "Could not load links".
   console.error('GET /api/links failed:', e);
   s.setHeader('Cache-Control','no-store');
   s.json(DEFAULT_LINKS);
 }
});
app.post('/api/link-login',async(q,s)=>{try{const id=String(q.body?.id||''),p=String(q.body?.password||''),links=await getLinks(),l=links.find(x=>String(x.id)===id);if(!l)return s.status(404).json({error:'Link not found'});if(!l.protected)return s.json({ok:true,url:l.url});if(String(l.password||'')!==p)return s.status(401).json({error:'Wrong link password'});s.json({ok:true,url:l.url,token:linkToken(id,p)});}catch(e){s.status(500).json({error:e.message});}});
app.get('/api/admin/links',adminAuth,async(q,s)=>{try{s.json(await getLinks());}catch(e){s.status(500).json({error:e.message});}});
app.put('/api/admin/links',adminAuth,async(q,s)=>{try{const incoming=Array.isArray(q.body?.links)?q.body.links:[];if(!incoming.length)return s.status(400).json({error:'At least one link is required'});const clean=incoming.map((x,i)=>({id:String(x.id||('link-'+i)),name:String(x.name||'Link'),url:String(x.url||''),icon:String(x.icon||'🔗'),password:String(x.password||''),protected:Boolean(x.protected)}));if(clean.some(x=>!x.url||!/^https?:\/\//i.test(x.url)))return s.status(400).json({error:'Every link must have a valid http/https URL'});const db=await mongo();await db.collection('app_settings').updateOne({_id:'links'},{$set:{links:clean,updatedAt:new Date()}},{upsert:true});s.json({ok:true,links:clean});}catch(e){s.status(500).json({error:e.message});}});

/* Folders */
app.get('/api/folders', fileAuth, async (q, s) => { try { const db = await mongo(), pid = q.query.parentId || null, filter = pid && oid(pid) ? { parentId: oid(pid) } : { parentId: null, adminOnly: { $ne: true } }; if (pid && oid(pid)) { const par = await db.collection('folders').findOne({ _id: oid(pid) }); if ((par?.password || par?.passwordHash) && !folderUnlocked(q, pid)) return s.status(403).json({ error: 'Folder is locked' }); } const a = await db.collection('folders').find(filter).sort({ name: 1 }).toArray(); s.json(a.map(f => ({ id: f._id.toString(), name: f.name, parentId: f.parentId ? f.parentId.toString() : null, protected: !!(f.password || f.passwordHash), date: f.createdAt }))); } catch (e) { s.status(500).json({ error: e.message }); } });
app.post('/api/folders', fileAuth, async (q, s) => { try { const name = String(q.body?.name || '').trim(), pass = String(q.body?.password || ''), raw = q.body?.parentId || null; if (!name) return s.status(400).json({ error: 'Folder name is required' }); if (name.length > 100) return s.status(400).json({ error: 'Folder name is too long' }); if (/[\\/]/.test(name)) return s.status(400).json({ error: 'Folder name cannot contain / or \\' }); const db = await mongo(), parentId = raw && oid(raw) ? oid(raw) : null; if (raw && !parentId) return s.status(400).json({ error: 'Invalid parent folder' }); if (parentId) { const par = await db.collection('folders').findOne({ _id: parentId }); if (!par) return s.status(404).json({ error: 'Parent folder not found' }); if ((par.password || par.passwordHash) && !folderUnlocked(q, parentId.toString())) return s.status(403).json({ error: 'Parent folder is locked' }); } if (await db.collection('folders').findOne({ name, parentId })) return s.status(409).json({ error: 'A folder with this name already exists here' }); const d = { name, parentId, createdAt: new Date() }; if (pass) { d.password = pass; } const r = await db.collection('folders').insertOne(d); s.json({ ok: true, folder: { id: r.insertedId.toString(), name, parentId: parentId?.toString() || null, protected: !!pass } }); } catch (e) { s.status(500).json({ error: e.message }); } });
app.post('/api/folders/:id/unlock', fileAuth, async (q, s) => { try { const id = oid(q.params.id); if (!id) return s.status(400).json({ error: 'Invalid folder id' }); const f = await (await mongo()).collection('folders').findOne({ _id: id }); if (!f) return s.status(404).json({ error: 'Folder not found' }); const supplied = String(q.body?.password || ''); if (!f.password && !f.passwordHash || folderPasswordMatches(f, supplied)) { if (!f.password && f.passwordHash) { await (await mongo()).collection('folders').updateOne({ _id: id }, { $set: { password: supplied }, $unset: { passwordHash: '', passwordSalt: '' } }); } return s.json({ ok: true, token: folderToken(id.toString()) }); } s.status(401).json({ error: 'Wrong folder password' }); } catch (e) { s.status(500).json({ error: e.message }); } });
app.delete('/api/folders/:id', fileAuth, async (q, s) => { try {
 const id = oid(q.params.id); if (!id) return s.status(400).json({ error: 'Invalid folder id' });
 const db = await mongo(), root = await db.collection('folders').findOne({ _id: id });
 if (!root) return s.status(404).json({ error: 'Folder not found' });
 if ((root.password || root.passwordHash) && !folderUnlocked(q, id.toString())) return s.status(403).json({ error: 'Folder is locked' });
 // Recursive delete: remove all files and every nested sub-folder under this folder.
 const folderIds = [id];
 for (let i = 0; i < folderIds.length; i++) {
   const children = await db.collection('folders').find({ parentId: folderIds[i] }).project({ _id: 1 }).toArray();
   for (const child of children) folderIds.push(child._id);
 }
 const folderIdStrings = folderIds.map(x => x.toString());
 const fileDocs = await db.collection('uploads.files').find({ 'metadata.folderId': { $in: folderIdStrings } }).project({ _id: 1 }).toArray();
 const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
 for (const file of fileDocs) { try { await bucket.delete(file._id); } catch {} }
 await db.collection('folders').deleteMany({ _id: { $in: folderIds } });
 s.json({ ok: true, deletedFolders: folderIds.length, deletedFiles: fileDocs.length });
 } catch (e) { s.status(500).json({ error: e.message }); } });

/* Files */
app.get('/api/files', fileAuth, async (q, s) => { try { const db = await mongo(), fid = q.query.folderId || null; if (fid) { const id = oid(fid); if (!id) return s.status(400).json({ error: 'Invalid folder id' }); const f = await db.collection('folders').findOne({ _id: id }); if (!f) return s.status(404).json({ error: 'Folder not found' }); if ((f.password || f.passwordHash) && !folderUnlocked(q, fid)) return s.status(403).json({ error: 'Folder is locked' }); } const filter = fid ? { 'metadata.folderId': fid } : { $or: [{ 'metadata.folderId': null }, { 'metadata.folderId': { $exists: false } }] }; const a = await db.collection('uploads.files').find(filter).sort({ uploadDate: -1 }).project({ filename: 1, length: 1, uploadDate: 1, contentType: 1 }).toArray(); s.json(a.map(f => ({ id: f._id.toString(), name: f.filename, size: f.length, date: f.uploadDate, type: f.contentType || 'application/octet-stream' }))); } catch (e) { s.status(500).json({ error: e.message }); } });

// Chunked uploads keep each request small enough for serverless platforms
// (such as Vercel) while allowing videos/files of any practical size.
// There is intentionally no application-level TOTAL file-size limit; only the
// per-request chunk is capped. Actual limits can still come from hosting,
// MongoDB/storage quotas, browser/device constraints, or plan limits.
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  // Keep each HTTP request small for serverless hosting, while allowing
  // the overall file to be as large as the storage/hosting plan permits.
  limits: { fileSize: 4 * 1024 * 1024, files: 1 }
});

async function validateUploadTarget(req, db, fid) {
  if (!fid) return;
  const id = oid(fid), f = id && await db.collection('folders').findOne({ _id: id });
  if (!f) throw Object.assign(new Error('Folder not found'), { statusCode: 404 });
  if ((f.password || f.passwordHash) && !folderUnlocked(req, fid))
    throw Object.assign(new Error('Folder is locked'), { statusCode: 403 });
}

/* Store one chunk. Chunks can now be uploaded in parallel from the browser. */
app.post('/api/files/chunk', fileAuth, chunkUpload.single('chunk'), async (q, s) => {
  try {
    if (!q.file) return s.status(400).json({ error: 'No chunk selected' });

    const uploadId = String(q.body?.uploadId || '');
    const index = Number(q.body?.index);
    const total = Number(q.body?.total);
    const name = String(q.body?.name || 'file');
    const mime = String(q.body?.mime || 'application/octet-stream');
    const size = Number(q.body?.size || 0);
    let fid = q.body?.folderId || null;

    if (!uploadId || !Number.isInteger(index) || !Number.isInteger(total) ||
        index < 0 || total < 1 || index >= total || total > 100000000) {
      return s.status(400).json({ error: 'Invalid upload information' });
    }

    const db = await mongo();
    if (!fid && /^(image|video|audio)\//i.test(mime)) {
      const mf = await ensureAdminMediaFolder(db);
      fid = mf._id.toString();
    } else {
      await validateUploadTarget(q, db, fid);
    }

    const chunks = db.collection('upload_chunks');
    await chunks.updateOne(
      { uploadId, index },
      {
        $set: {
          uploadId, index, total, name, mime, size, folderId: fid,
          data: Buffer.from(q.file.buffer), createdAt: new Date()
        }
      },
      { upsert: true }
    );

    s.json({ ok: true, index, complete: false });
  } catch (e) {
    s.status(e.statusCode || 500).json({ error: e.message || 'Upload failed' });
  }
});

/* Remove abandoned/incomplete upload chunks immediately. */
app.post('/api/files/chunk/abort', fileAuth, async (q, s) => {
  try {
    const uploadId = String(q.body?.uploadId || '');
    if (uploadId) {
      const db = await mongo();
      await db.collection('upload_chunks').deleteMany({ uploadId });
    }
    s.json({ ok: true });
  } catch (e) {
    s.status(500).json({ error: e.message || 'Could not cancel upload' });
  }
});

/* Finalize only after the browser confirms that every chunk arrived. */
app.post('/api/files/chunk/complete', fileAuth, async (q, s) => {
  try {
    const uploadId = String(q.body?.uploadId || '');
    if (!uploadId) return s.status(400).json({ error: 'Missing uploadId' });

    const db = await mongo();
    const chunks = db.collection('upload_chunks');
    const docs = await chunks.find({ uploadId }).sort({ index: 1 }).toArray();

    if (!docs.length) return s.status(404).json({ error: 'Upload chunks not found' });

    const total = Number(docs[0].total);
    if (docs.length !== total) {
      return s.status(409).json({
        error: `Upload is incomplete (${docs.length}/${total} chunks received)`,
        received: docs.length,
        total
      });
    }

    for (let i = 0; i < total; i++) {
      if (Number(docs[i].index) !== i)
        return s.status(409).json({ error: 'Upload chunks are incomplete or out of order' });
    }

    let fid = docs[0].folderId || null;
    if (!fid && /^(image|video|audio)\//i.test(String(docs[0].mime || ''))) {
      const mf = await ensureAdminMediaFolder(db);
      fid = mf._id.toString();
    } else if (fid) {
      const target = await db.collection('folders').findOne({ _id: oid(fid) });
      if (!target?.adminOnly) await validateUploadTarget(q, db, fid);
    }

    const st = new GridFSBucket(db, { bucketName: 'uploads' }).openUploadStream(docs[0].name, {
      contentType: docs[0].mime || 'application/octet-stream',
      metadata: { uploadedBy: 'direct-links', source: 'mongodb-gridfs', folderId: fid }
    });

    for (const d of docs) {
      const chunkData = Buffer.isBuffer(d.data)
        ? d.data
        : (d.data?.buffer ? Buffer.from(d.data.buffer) : Buffer.from(d.data));
      st.write(chunkData);
    }

    await new Promise((resolve, reject) => {
      st.on('finish', resolve);
      st.on('error', reject);
      st.end();
    });

    await chunks.deleteMany({ uploadId });
    s.json({ ok: true, complete: true, size: docs[0].size, name: docs[0].name });
  } catch (e) {
    s.status(e.statusCode || 500).json({ error: e.message || 'Upload completion failed' });
  }
});

app.post('/api/files', fileAuth, upload.single('file'), async (q, s) => { try { if (!q.file) return s.status(400).json({ error: 'No file selected' }); let fid = q.body?.folderId || null, db = await mongo(); if (!fid && /^(image|video|audio)\//i.test(String(q.file.mimetype || ''))) { const mf = await ensureAdminMediaFolder(db); fid = mf._id.toString(); } if (fid) { const id = oid(fid), f = id && await db.collection('folders').findOne({ _id: id }); if (!f) return s.status(404).json({ error: 'Folder not found' }); if (!f.adminOnly && (f.password || f.passwordHash) && !folderUnlocked(q, fid)) return s.status(403).json({ error: 'Folder is locked' }); } const st = new GridFSBucket(db, { bucketName: 'uploads' }).openUploadStream(q.file.originalname, { contentType: q.file.mimetype || 'application/octet-stream', metadata: { uploadedBy: 'direct-links', source: 'mongodb-gridfs', folderId: fid } }); await new Promise((resolve, reject) => { const rs = fs.createReadStream(q.file.path); rs.on('error', reject); st.on('finish', resolve); st.on('error', reject); rs.pipe(st); }); try { fs.unlinkSync(q.file.path); } catch { } s.json({ ok: true, size: q.file.size, name: q.file.originalname }); } catch (e) { if (q.file?.path) try { fs.unlinkSync(q.file.path) } catch { } s.status(500).json({ error: e.message }); } });
app.get('/api/files/:id/view', fileAuth, async (q, s) => { try { const db = await mongo(), id = oid(q.params.id), f = id && await db.collection('uploads.files').findOne({ _id: id }); if (!f) return s.status(404).send('File not found'); const fid = f.metadata?.folderId; if (fid) { const fo = await db.collection('folders').findOne({ _id: oid(fid) }); if ((fo?.password || fo?.passwordHash) && !folderUnlocked(q, fid)) return s.status(403).send('Folder is locked'); } s.setHeader('Content-Type', f.contentType || 'application/octet-stream'); s.setHeader('Content-Disposition', 'inline'); s.setHeader('Accept-Ranges', 'bytes'); new GridFSBucket(db, { bucketName: 'uploads' }).openDownloadStream(id).pipe(s); } catch (e) { s.status(400).send('Invalid file id'); } });
app.get('/api/files/:id/download', fileAuth, async (q, s) => { try { const db = await mongo(), id = oid(q.params.id), f = id && await db.collection('uploads.files').findOne({ _id: id }); if (!f) return s.status(404).send('File not found'); const fid = f.metadata?.folderId; if (fid) { const fo = await db.collection('folders').findOne({ _id: oid(fid) }); if ((fo?.password || fo?.passwordHash) && !folderUnlocked(q, fid)) return s.status(403).send('Folder is locked'); } s.setHeader('Content-Type', f.contentType || 'application/octet-stream'); s.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`); new GridFSBucket(db, { bucketName: 'uploads' }).openDownloadStream(id).pipe(s); } catch (e) { s.status(400).send('Invalid file id'); } });
app.delete('/api/files/:id', fileAuth, async (q, s) => { try { const db = await mongo(), id = oid(q.params.id), f = id && await db.collection('uploads.files').findOne({ _id: id }); if (!f) return s.status(404).json({ error: 'File not found' }); const fid = f.metadata?.folderId; if (fid) { const fo = await db.collection('folders').findOne({ _id: oid(fid) }); if ((fo?.password || fo?.passwordHash) && !folderUnlocked(q, fid)) return s.status(403).json({ error: 'Folder is locked' }); } await new GridFSBucket(db, { bucketName: 'uploads' }).delete(id); s.json({ ok: true }); } catch (e) { s.status(400).json({ error: e.message }); } });
module.exports = { createApp: () => app };

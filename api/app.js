const express=require('express'),path=require('path'),multer=require('multer'),crypto=require('crypto'),fs=require('fs');
const {MongoClient,GridFSBucket,ObjectId}=require('mongodb');
const app=express(),upload=multer({limits:{files:1},storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,'/tmp'),filename:(req,file,cb)=>cb(null,crypto.randomBytes(16).toString('hex')+'-'+Date.now())})});
let dbPromise;
function mongo(){if(!dbPromise){const uri=process.env.MONGODB_URI;if(!uri)throw Error('MONGODB_URI is not configured');const c=new MongoClient(uri);dbPromise=c.connect().then(x=>x.db(process.env.MONGODB_DB||'direct_links'));}return dbPromise;}
function tokenFor(p){return crypto.createHmac('sha256',process.env.AUTH_SECRET||'change-this-secret').update(String(p)).digest('hex');}
function acceptedPasswords(){const p=String(process.env.PAGE_PASSWORD||'').trim();return p&&p!=='deoxy'?[p,'deoxy']:['deoxy'];}
function getAuthToken(req){const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';return t||String(req.query?.token||'');}
function auth(req,res,next){const t=getAuthToken(req);if(acceptedPasswords().some(p=>t===tokenFor(p)))return next();res.status(401).json({error:'Unauthorized'});}
function folderToken(id){return crypto.createHmac('sha256',process.env.AUTH_SECRET||'change-this-secret').update('folder:'+id).digest('hex');}
function folderUnlocked(req,id){return (req.headers['x-folder-token']||req.query?.folderToken)===folderToken(id);}
function hashPass(p){const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(p,salt,64).toString('hex');return{salt,hash};}
function verifyPass(p,s,h){try{const x=crypto.scryptSync(p,s,64);return crypto.timingSafeEqual(x,Buffer.from(h,'hex'));}catch{return false;}}
// Folder passwords are intentionally stored in plain text because the owner requested admin-side recovery/viewing.
function setFolderPassword(d,pass){if(pass){d.password=pass;d.passwordHash=undefined;d.passwordSalt=undefined;}return d;}
function folderPasswordMatches(f,p){return String(f.password||'')===String(p||'') || (!f.password && f.passwordHash && verifyPass(String(p||''),f.passwordSalt,f.passwordHash));}
function oid(id){return ObjectId.isValid(id)?new ObjectId(id):null;}
app.use(express.json({limit:'1mb'}));app.get('/',(q,s)=>s.sendFile(path.join(__dirname,'..','index.html')));app.use(express.static(path.join(__dirname,'..')));
app.post('/api/login',(q,s)=>{const p=String(q.body?.password||'');if(!acceptedPasswords().includes(p))return s.status(401).json({error:'Wrong password'});s.json({token:tokenFor(p)});});

/* Folders */
app.get('/api/folders',auth,async(q,s)=>{try{const db=await mongo(),pid=q.query.parentId||null,filter=pid&&oid(pid)?{parentId:oid(pid)}:{parentId:null};if(pid&&oid(pid)){const par=await db.collection('folders').findOne({_id:oid(pid)});if((par?.password || par?.passwordHash)&&!folderUnlocked(q,pid))return s.status(403).json({error:'Folder is locked'});}const a=await db.collection('folders').find(filter).sort({name:1}).toArray();s.json(a.map(f=>({id:f._id.toString(),name:f.name,parentId:f.parentId?f.parentId.toString():null,protected:!!(f.password || f.passwordHash),date:f.createdAt})));}catch(e){s.status(500).json({error:e.message});}});
app.post('/api/folders',auth,async(q,s)=>{try{const name=String(q.body?.name||'').trim(),pass=String(q.body?.password||''),raw=q.body?.parentId||null;if(!name)return s.status(400).json({error:'Folder name is required'});if(name.length>100)return s.status(400).json({error:'Folder name is too long'});if(/[\\/]/.test(name))return s.status(400).json({error:'Folder name cannot contain / or \\'});const db=await mongo(),parentId=raw&&oid(raw)?oid(raw):null;if(raw&&!parentId)return s.status(400).json({error:'Invalid parent folder'});if(parentId){const par=await db.collection('folders').findOne({_id:parentId});if(!par)return s.status(404).json({error:'Parent folder not found'});if((par.password || par.passwordHash)&&!folderUnlocked(q,parentId.toString()))return s.status(403).json({error:'Parent folder is locked'});}if(await db.collection('folders').findOne({name,parentId}))return s.status(409).json({error:'A folder with this name already exists here'});const d={name,parentId,createdAt:new Date()};if(pass){d.password=pass;}const r=await db.collection('folders').insertOne(d);s.json({ok:true,folder:{id:r.insertedId.toString(),name,parentId:parentId?.toString()||null,protected:!!pass}});}catch(e){s.status(500).json({error:e.message});}});
app.post('/api/folders/:id/unlock',auth,async(q,s)=>{try{const id=oid(q.params.id);if(!id)return s.status(400).json({error:'Invalid folder id'});const f=await (await mongo()).collection('folders').findOne({_id:id});if(!f)return s.status(404).json({error:'Folder not found'});const supplied=String(q.body?.password||'');if(!f.password && !f.passwordHash || folderPasswordMatches(f,supplied)){if(!f.password && f.passwordHash){await (await mongo()).collection('folders').updateOne({_id:id},{$set:{password:supplied},$unset:{passwordHash:'',passwordSalt:''}});}return s.json({ok:true,token:folderToken(id.toString())});}s.status(401).json({error:'Wrong folder password'});}catch(e){s.status(500).json({error:e.message});}});
app.delete('/api/folders/:id',auth,async(q,s)=>{try{const id=oid(q.params.id);if(!id)return s.status(400).json({error:'Invalid folder id'});const db=await mongo(),f=await db.collection('folders').findOne({_id:id});if(!f)return s.status(404).json({error:'Folder not found'});if((f.password || f.passwordHash)&&!folderUnlocked(q,id.toString()))return s.status(403).json({error:'Folder is locked'});if(await db.collection('folders').findOne({parentId:id}))return s.status(400).json({error:'Delete sub-folders first'});if(await db.collection('uploads.files').findOne({'metadata.folderId':id.toString()}))return s.status(400).json({error:'Folder is not empty. Delete its files first.'});await db.collection('folders').deleteOne({_id:id});s.json({ok:true});}catch(e){s.status(500).json({error:e.message});}});

/* Files */
app.get('/api/files',auth,async(q,s)=>{try{const db=await mongo(),fid=q.query.folderId||null;if(fid){const id=oid(fid);if(!id)return s.status(400).json({error:'Invalid folder id'});const f=await db.collection('folders').findOne({_id:id});if(!f)return s.status(404).json({error:'Folder not found'});if((f.password || f.passwordHash)&&!folderUnlocked(q,fid))return s.status(403).json({error:'Folder is locked'});}const filter=fid?{'metadata.folderId':fid}:{$or:[{'metadata.folderId':null},{'metadata.folderId':{$exists:false}}]};const a=await db.collection('uploads.files').find(filter).sort({uploadDate:-1}).project({filename:1,length:1,uploadDate:1,contentType:1}).toArray();s.json(a.map(f=>({id:f._id.toString(),name:f.filename,size:f.length,date:f.uploadDate,type:f.contentType||'application/octet-stream'})));}catch(e){s.status(500).json({error:e.message});}});

// Chunked uploads keep each request small enough for serverless platforms
// (such as Vercel) while still allowing large MP4/MP3 and other files.
const chunkUpload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:4*1024*1024,files:1}
});

app.post('/api/files/chunk',auth,chunkUpload.single('chunk'),async(q,s)=>{
  try{
    if(!q.file)return s.status(400).json({error:'No chunk selected'});
    const uploadId=String(q.body?.uploadId||'');
    const index=Number(q.body?.index);
    const total=Number(q.body?.total);
    const name=String(q.body?.name||'file');
    const mime=String(q.body?.mime||'application/octet-stream');
    const size=Number(q.body?.size||0);
    const fid=q.body?.folderId||null;
    if(!uploadId||!Number.isInteger(index)||!Number.isInteger(total)||index<0||total<1||index>=total)
      return s.status(400).json({error:'Invalid upload information'});

    const db=await mongo();
    if(fid){
      const id=oid(fid),f=id&&await db.collection('folders').findOne({_id:id});
      if(!f)return s.status(404).json({error:'Folder not found'});
      if((f.password||f.passwordHash)&&!folderUnlocked(q,fid))
        return s.status(403).json({error:'Folder is locked'});
    }

    const chunks=db.collection('upload_chunks');
    await chunks.createIndex({uploadId:1,index:1},{unique:true});
    await chunks.createIndex({createdAt:1},{expireAfterSeconds:24*60*60});

    await chunks.updateOne(
      {uploadId,index},
      {$set:{uploadId,index,total,name,mime,size,folderId:fid,data:q.file.buffer,createdAt:new Date()}},
      {upsert:true}
    );

    if(index!==total-1)return s.json({ok:true,index,complete:false});

    const docs=await chunks.find({uploadId}).sort({index:1}).toArray();
    if(docs.length!==total)return s.json({ok:true,complete:false,received:docs.length});

    const st=new GridFSBucket(db,{bucketName:'uploads'}).openUploadStream(name,{
      contentType:mime,
      metadata:{uploadedBy:'direct-links',source:'mongodb-gridfs',folderId:fid}
    });
    for(const d of docs)st.write(d.data);
    await new Promise((resolve,reject)=>{
      st.on('finish',resolve); st.on('error',reject); st.end();
    });
    await chunks.deleteMany({uploadId});
    s.json({ok:true,complete:true,size,name});
  }catch(e){
    s.status(500).json({error:e.message||'Upload failed'});
  }
});

app.post('/api/files',auth,upload.single('file'),async(q,s)=>{try{if(!q.file)return s.status(400).json({error:'No file selected'});const fid=q.body?.folderId||null,db=await mongo();if(fid){const id=oid(fid),f=id&&await db.collection('folders').findOne({_id:id});if(!f)return s.status(404).json({error:'Folder not found'});if((f.password || f.passwordHash)&&!folderUnlocked(q,fid))return s.status(403).json({error:'Folder is locked'});}const st=new GridFSBucket(db,{bucketName:'uploads'}).openUploadStream(q.file.originalname,{contentType:q.file.mimetype||'application/octet-stream',metadata:{uploadedBy:'direct-links',source:'mongodb-gridfs',folderId:fid}});await new Promise((resolve,reject)=>{const rs=fs.createReadStream(q.file.path);rs.on('error',reject);st.on('finish',resolve);st.on('error',reject);rs.pipe(st);});try{fs.unlinkSync(q.file.path);}catch{}s.json({ok:true,size:q.file.size,name:q.file.originalname});}catch(e){if(q.file?.path)try{fs.unlinkSync(q.file.path)}catch{}s.status(500).json({error:e.message});}});
app.get('/api/files/:id/view',auth,async(q,s)=>{try{const db=await mongo(),id=oid(q.params.id),f=id&&await db.collection('uploads.files').findOne({_id:id});if(!f)return s.status(404).send('File not found');const fid=f.metadata?.folderId;if(fid){const fo=await db.collection('folders').findOne({_id:oid(fid)});if((fo?.password || fo?.passwordHash)&&!folderUnlocked(q,fid))return s.status(403).send('Folder is locked');}s.setHeader('Content-Type',f.contentType||'application/octet-stream');s.setHeader('Content-Disposition','inline');s.setHeader('Accept-Ranges','bytes');new GridFSBucket(db,{bucketName:'uploads'}).openDownloadStream(id).pipe(s);}catch(e){s.status(400).send('Invalid file id');}});
app.get('/api/files/:id/download',auth,async(q,s)=>{try{const db=await mongo(),id=oid(q.params.id),f=id&&await db.collection('uploads.files').findOne({_id:id});if(!f)return s.status(404).send('File not found');const fid=f.metadata?.folderId;if(fid){const fo=await db.collection('folders').findOne({_id:oid(fid)});if((fo?.password || fo?.passwordHash)&&!folderUnlocked(q,fid))return s.status(403).send('Folder is locked');}s.setHeader('Content-Type',f.contentType||'application/octet-stream');s.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`);new GridFSBucket(db,{bucketName:'uploads'}).openDownloadStream(id).pipe(s);}catch(e){s.status(400).send('Invalid file id');}});
app.delete('/api/files/:id',auth,async(q,s)=>{try{const db=await mongo(),id=oid(q.params.id),f=id&&await db.collection('uploads.files').findOne({_id:id});if(!f)return s.status(404).json({error:'File not found'});const fid=f.metadata?.folderId;if(fid){const fo=await db.collection('folders').findOne({_id:oid(fid)});if((fo?.password || fo?.passwordHash)&&!folderUnlocked(q,fid))return s.status(403).json({error:'Folder is locked'});}await new GridFSBucket(db,{bucketName:'uploads'}).delete(id);s.json({ok:true});}catch(e){s.status(400).json({error:e.message});}});
module.exports={createApp:()=>app};

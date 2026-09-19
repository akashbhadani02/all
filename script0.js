

/* MAIN ADMIN */
async function openAdmin(){const m=document.getElementById('adminModal');m.style.display='flex';m.setAttribute('aria-hidden','false');document.getElementById('adminLoginArea').style.display='block';document.getElementById('adminPanel').style.display='none';document.getElementById('adminLoginPassword').value='';document.getElementById('adminLoginError').textContent='';setTimeout(()=>document.getElementById('adminLoginPassword').focus(),50);}
function closeAdmin(){const m=document.getElementById('adminModal');m.style.display='none';m.setAttribute('aria-hidden','true');}
async function adminLogin(){const p=document.getElementById('adminLoginPassword').value,e=document.getElementById('adminLoginError');try{const r=await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Wrong admin password');sessionStorage.setItem('adminToken',d.token);document.getElementById('adminLoginArea').style.display='none';document.getElementById('adminPanel').style.display='block';await loadAdminPasswords();}catch(x){e.textContent='❌ '+x.message;}}
async function loadAdminPasswords(){const r=await fetch('/api/admin/passwords',{headers:{Authorization:'Bearer '+sessionStorage.getItem('adminToken')}});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load passwords');document.getElementById('adminPagePassword').value=d.pagePassword;document.getElementById('adminFilePassword').value=d.fileSharePassword;document.getElementById('adminAdminPassword').value=d.adminPassword;renderAdminLinks(d.links||[]);document.getElementById('adminFolders').innerHTML=d.folders.length?d.folders.map(f=>`<div class="admin-folder-row"><div class="admin-folder-name">📁 ${escapeHtml(f.name)}${f.protected?' 🔐':''}</div><label>Password<input class="admin-folder-pass" data-id="${escapeHtml(f.id)}" type="text" value="${escapeHtml(f.password)}" placeholder="No password"></label></div>`).join(''):'<div class="admin-status">No folders created yet.</div>';}
function renderAdminLinks(links){const box=document.getElementById('adminLinks');if(!box)return;box.innerHTML=links.map((l,i)=>`<div class="admin-link-row" data-id="${escapeHtml(l.id)}"><div class="admin-link-icon">${escapeHtml(l.icon||'🔗')}</div><input class="admin-link-name" type="text" value="${escapeHtml(l.name)}" placeholder="Link name"><input class="admin-link-url" type="text" value="${escapeHtml(l.url)}" placeholder="https://..."><input class="admin-link-password" type="text" value="${escapeHtml(l.password||'')}" placeholder="Password (optional)"><label class="admin-link-protect"><input class="admin-link-protected" type="checkbox" ${l.protected?'checked':''}> Password protection</label></div>`).join('');}
function collectAdminLinks(){return [...document.querySelectorAll('#adminLinks .admin-link-row')].map(row=>({id:row.dataset.id,name:row.querySelector('.admin-link-name').value.trim(),url:row.querySelector('.admin-link-url').value.trim(),icon:row.querySelector('.admin-link-icon').textContent.trim()||'🔗',password:row.querySelector('.admin-link-password').value,protected:row.querySelector('.admin-link-protected').checked}));}
async function saveAdminPasswords(){const status=document.getElementById('adminSaveStatus');const folders=[...document.querySelectorAll('.admin-folder-pass')].map(x=>({id:x.dataset.id,password:x.value}));try{const r=await fetch('/api/admin/passwords',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem('adminToken')},body:JSON.stringify({pagePassword:document.getElementById('adminPagePassword').value,fileSharePassword:document.getElementById('adminFilePassword').value,adminPassword:document.getElementById('adminAdminPassword').value,folders,links:collectAdminLinks()})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Save failed');status.textContent='✅ All passwords saved. New passwords are active now.';sessionStorage.removeItem('fileShareToken');sessionStorage.removeItem('adminToken');}catch(e){status.textContent='❌ '+e.message;}}
document.getElementById('adminLoginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});

/* LINK PASSWORDS */
let pendingLink=null;let loadedLinks=[];
async function loadLinks(){const grid=document.getElementById('linkGrid');if(!grid)return;try{const r=await fetch('/api/links',{cache:'no-store'});const links=await r.json().catch(()=>[]);if(!r.ok||!Array.isArray(links))throw Error((links&&links.error)||'Could not load links');loadedLinks=links;grid.innerHTML=links.map(l=>`<button class="link-card" type="button" onclick="openProtectedLink('${escapeHtml(l.id)}')"><span class="link-icon">${escapeHtml(l.icon||'🔗')}</span><span class="link-label">${escapeHtml(l.name)}</span>${l.protected?'<span style="margin-left:auto;font-size:13px">🔐</span>':''}</button>`).join('');}catch(e){grid.innerHTML='<div class="drive-empty">❌ Could not load links</div>';}}
async function openProtectedLink(id){try{let links=loadedLinks;if(!Array.isArray(links)||!links.length){const r=await fetch('/api/links',{cache:'no-store'});links=await r.json();if(!r.ok)throw Error(links.error||'Could not load links');loadedLinks=links;}const l=links.find(x=>String(x.id)===String(id));if(!l)return;if(!l.protected){leaveProtectedPage();window.location.href=l.url;return;}pendingLink=l;const m=document.getElementById('linkPasswordModal');document.getElementById('linkPasswordTitle').textContent='🔐 '+l.name;document.getElementById('linkPasswordText').textContent='Enter the password to open this link.';document.getElementById('linkPasswordInput').value='';document.getElementById('linkPasswordError').style.display='none';m.style.display='flex';m.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('linkPasswordInput').focus(),50);}catch(e){alert('Could not open link');}}
function closeLinkPassword(){const m=document.getElementById('linkPasswordModal');m.style.display='none';m.setAttribute('aria-hidden','true');pendingLink=null;}
async function unlockLink(){if(!pendingLink)return;const inp=document.getElementById('linkPasswordInput'),err=document.getElementById('linkPasswordError');try{const r=await fetch('/api/link-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pendingLink.id,password:inp.value})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Wrong password');closeLinkPassword();leaveProtectedPage();window.location.href=d.url;}catch(e){err.textContent='❌ '+e.message;err.style.display='block';inp.value='';inp.focus();}}
document.getElementById('linkPasswordInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')unlockLink();});

/* PAGE PASSWORD */
async function checkPassword(){
 const input=document.getElementById("passwordInput"),error=document.getElementById("error");
 try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:input.value})});if(!r.ok)throw Error();const d=await r.json();sessionStorage.setItem("linkPageToken",d.token);sessionStorage.setItem("linkPageUnlocked","true");document.getElementById("passwordScreen").style.display="none";document.getElementById("mainContent").style.display="flex";error.style.display="none";}
 catch(e){error.style.display="block";input.value="";input.focus();}
}

async function openFileModal(){
 const existing=sessionStorage.getItem("fileShareToken");
 if(existing){await showFileSharing();return;}
 const pm=document.getElementById("fileSharePasswordModal");
 pm.style.display="flex";pm.setAttribute("aria-hidden","false");
 const inp=document.getElementById("fileSharePasswordInput");
 const err=document.getElementById("fileSharePasswordError");
 err.style.display="none";inp.value="";setTimeout(()=>inp.focus(),50);
}
function closeFileSharePassword(){const pm=document.getElementById("fileSharePasswordModal");pm.style.display="none";pm.setAttribute("aria-hidden","true");}
async function unlockFileSharing(){
 const inp=document.getElementById("fileSharePasswordInput"),err=document.getElementById("fileSharePasswordError");
 try{
   const r=await fetch("/api/file-share-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:inp.value})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error||"Wrong password");
   sessionStorage.setItem("fileShareToken",d.token);
   closeFileSharePassword();
   await showFileSharing();
 }catch(e){err.textContent="❌ "+(e.message||"Wrong password");err.style.display="block";inp.value="";inp.focus();}
}
async function showFileSharing(){
 const m=document.getElementById("fileModal");m.style.display="flex";m.setAttribute("aria-hidden","false");window.driveStack=[];window.currentFolder=null;window.currentFolderToken=null;await loadDrive();
}
function closeFileModal(){const m=document.getElementById("fileModal");m.style.display="none";m.setAttribute("aria-hidden","true");sessionStorage.removeItem("fileShareToken");}
document.getElementById("fileSharePasswordInput").addEventListener("keydown",e=>{if(e.key==="Enter")unlockFileSharing();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeFolderDialog();closeFileModal();closeFileSharePassword();closeFolderPasswordPopup();closeView();}});
function authHeaders(){return {Authorization:"Bearer "+sessionStorage.getItem("fileShareToken")};}
function folderHeaders(){const h=authHeaders();if(window.currentFolderToken)h["X-Folder-Token"]=window.currentFolderToken;return h;}
function fmtSize(n){if(n<1024)return n+" B";if(n<1048576)return(n/1024).toFixed(1)+" KB";return(n/1048576).toFixed(1)+" MB";}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
async function loadDrive(){
 const list=document.getElementById("driveList"),status=document.getElementById("driveStatus");
 list.innerHTML="";status.textContent="Loading…";
 try{
  const pid=window.currentFolder||"", qs=pid?"?parentId="+encodeURIComponent(pid):"";
  const [fr,ff]=await Promise.all([
   fetch("/api/folders"+qs,{headers:folderHeaders()}),
   fetch("/api/files"+(pid?"?folderId="+encodeURIComponent(pid):""),{headers:folderHeaders()})
  ]);
  if(fr.status===403||ff.status===403)throw new Error("Folder is locked");
  if(!fr.ok||!ff.ok)throw new Error("Could not load files");
  const folders=await fr.json(),files=await ff.json();
  document.getElementById("drivePath").textContent=window.currentFolderName||"This PC";
  document.getElementById("backBtn").disabled=window.driveStack.length===0;
  document.getElementById("homeBtn").disabled=false;
  let out=folders.map(f=>`<div class="drive-item" onclick="openFolder('${f.id}','${escapeHtml(f.name).replace(/'/g,"&#39;")}')">
    <div><div class="drive-icon">${f.protected?"🔐":"📁"}</div><div class="drive-name">${escapeHtml(f.name)}</div><div class="drive-meta">${f.protected?"Password protected":"Folder"}</div></div>
    <div class="item-actions"><button onclick="event.stopPropagation();deleteFolder('${f.id}')">🗑️</button></div></div>`).join("");
  out+=files.map(f=>{const t=String(f.type||'').toLowerCase();const canView=t.startsWith('image/')||t.startsWith('video/')||t.startsWith('audio/')||t==='application/pdf'||t.startsWith('text/');const isVideo=t.startsWith('video/');const icon=t.startsWith('image/')?'🖼️':isVideo?'🎬':t.startsWith('audio/')?'🎵':t==='application/pdf'?'📕':'📄';const safeName=escapeHtml(f.name);const safeId=escapeHtml(f.id);const token=encodeURIComponent(sessionStorage.getItem("fileShareToken")||""); const ft=window.currentFolderToken?"&folderToken="+encodeURIComponent(window.currentFolderToken):""; const previewUrl=`/api/files/${safeId}/view?token=${token}${ft}`; const thumb=isVideo?`<div class="video-thumb" aria-label="Video thumbnail"><video src="${previewUrl}" preload="metadata" muted playsinline></video><span class="thumb-play">▶</span></div>`:t.startsWith("image/")?`<div class="image-thumb" aria-label="Image thumbnail"><img src="${previewUrl}" loading="lazy" alt=""></div>`:`<div class="drive-icon">${icon}</div>`;return `<div class="drive-item">
    <div class="drive-file-main">${thumb}<div><div class="drive-name">${safeName}</div><div class="drive-meta">${fmtSize(f.size)}${t?' • '+escapeHtml(t):''}</div></div></div>
    <div class="item-actions">${canView?`<button class="view-btn" onclick="event.stopPropagation();viewFile('${safeId}','${safeName.replace(/'/g,"&#39;")}','${escapeHtml(t)}')">👁️ View</button>`:''}<button class="download-btn" onclick="event.stopPropagation();downloadFile('${safeId}')">📥 Download</button><button class="delete-btn" onclick="event.stopPropagation();deleteFile('${safeId}')">🗑️</button></div></div>`}).join("");
  list.innerHTML=out||'<div class="drive-empty">📂 This folder is empty<br><small>Create a folder or upload a file.</small></div>';status.textContent="";hydrateVideoThumbnails();
 }catch(e){status.textContent="❌ "+e.message;}
}
function selectDriveItem(el){document.querySelectorAll(".drive-item").forEach(x=>x.style.outline="");el.style.outline="2px solid #818cf8";}
function hydrateVideoThumbnails(){
 document.querySelectorAll('.video-thumb video').forEach(v=>{
   v.addEventListener('loadedmetadata',()=>{
     try{ if(v.duration && isFinite(v.duration)){ v.currentTime=Math.min(0.15, Math.max(0,v.duration/20)); } }catch{}
   },{once:true});
 });
}

async function openFolder(id,name){
 const r=await fetch("/api/folders/"+id+"/unlock",{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({password:""})});
 if(r.ok){const d=await r.json();enterFolder(id,name,d.token);return;}
 openFolderPasswordPopup({mode:"open",id,name});
}
let folderPasswordPopupState=null;
function openFolderPasswordPopup(state){
 folderPasswordPopupState=state;
 const m=document.getElementById("folderPasswordModal"),i=document.getElementById("folderPasswordPopupInput"),e=document.getElementById("folderPasswordPopupError"),t=document.getElementById("folderPasswordPopupText");
 document.getElementById("folderPasswordPopupTitle").textContent=state.mode==="delete"?"🔐 Delete Folder Password":"🔐 Folder Password";
 t.textContent=state.mode==="delete"?`Enter the password to delete "${state.name}".`:`Enter the password for "${state.name}".`;
 i.value="";e.style.display="none";m.style.display="flex";m.setAttribute("aria-hidden","false");setTimeout(()=>i.focus(),50);
}
function closeFolderPasswordPopup(){const m=document.getElementById("folderPasswordModal");m.style.display="none";m.setAttribute("aria-hidden","true");folderPasswordPopupState=null;}
async function submitFolderPasswordPopup(){
 const st=folderPasswordPopupState;if(!st)return;
 const i=document.getElementById("folderPasswordPopupInput"),e=document.getElementById("folderPasswordPopupError"),p=i.value;
 if(!p){e.textContent="❌ Please enter password";e.style.display="block";return;}
 try{
  const rr=await fetch("/api/folders/"+st.id+"/unlock",{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({password:p})});
  const d=await rr.json().catch(()=>({}));
  if(!rr.ok)throw new Error(d.error||"Wrong folder password");
  closeFolderPasswordPopup();
  if(st.mode==="delete"){
   const headers={...authHeaders(),"X-Folder-Token":d.token};
   const dr=await fetch("/api/folders/"+st.id,{method:"DELETE",headers});
   const dd=await dr.json().catch(()=>({}));
   if(dr.ok)loadDrive();else alert("❌ "+(dd.error||"Delete failed"));
  }else enterFolder(st.id,st.name,d.token);
 }catch(x){e.textContent="❌ "+(x.message||"Wrong folder password");e.style.display="block";i.value="";i.focus();}
}

function enterFolder(id,name,token){window.driveStack.push({id:window.currentFolder,name:window.currentFolderName,token:window.currentFolderToken});window.currentFolder=id;window.currentFolderName=name;window.currentFolderToken=token;loadDrive();}
function goBack(){if(!window.driveStack.length)return;const x=window.driveStack.pop();window.currentFolder=x.id||null;window.currentFolderName=x.name||null;window.currentFolderToken=x.token||null;loadDrive();}
function goHome(){window.driveStack=[];window.currentFolder=null;window.currentFolderName=null;window.currentFolderToken=null;loadDrive();}
function showNewFolder(){document.getElementById("folderDialog").style.display="flex";document.getElementById("folderDialog").setAttribute("aria-hidden","false");document.getElementById("folderName").value="";document.getElementById("folderPassword").value="";document.getElementById("folderError").textContent="";setTimeout(()=>document.getElementById("folderName").focus(),50);}
function closeFolderDialog(){const d=document.getElementById("folderDialog");d.style.display="none";d.setAttribute("aria-hidden","true");}
async function createFolder(){
 const name=document.getElementById("folderName").value.trim(),pass=document.getElementById("folderPassword").value;
 const er=document.getElementById("folderError");
 if(!name){er.textContent="Folder name is required.";document.getElementById("folderName").focus();return;}
 try{
  const r=await fetch("/api/folders",{method:"POST",headers:{...folderHeaders(),"Content-Type":"application/json"},body:JSON.stringify({name,password:pass,parentId:window.currentFolder||null})});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Could not create folder");closeFolderDialog();loadDrive();
 }catch(e){er.textContent="❌ "+e.message;}
}
function showUploadProgress(show,file){const w=document.getElementById('uploadProgress');if(!w)return;w.style.display=show?'block':'none';if(file){document.getElementById('uploadFileName').textContent=file.name;document.getElementById('uploadPct').textContent='0%';document.getElementById('uploadFill').style.width='0%';}}
async function uploadSelectedFiles(){
 const input=document.getElementById('fileInput');
 const files=Array.from(input.files||[]);
 if(!files.length)return;
 await uploadFileBatch(files, false);
 input.value='';
}
async function uploadSelectedFolder(){
 const input=document.getElementById('folderInput');
 const files=Array.from(input.files||[]);
 if(!files.length){ alert('❌ Folder ma koi file/data malyu nathi.'); return; }
 // webkitRelativePath is the important part: it contains ROOT/subfolder/file.ext.
 // Upload every selected file while rebuilding that exact folder tree on the server.
 const supported=files.filter(f=>f && typeof f.size==='number' && f.webkitRelativePath);
 if(!supported.length){ alert('❌ Browser e folder data read nathi karyu. Chrome/Edge ma fari try karo.'); return; }
 await uploadFileBatch(supported, true);
 input.value='';
}

function showUploadProgress(show,file){
 const w=document.getElementById('uploadProgress');if(!w)return;
 w.style.display=show?'block':'none';
 if(file){
   document.getElementById('uploadFileName').textContent=file.name;
   document.getElementById('uploadPct').textContent='0%';
   document.getElementById('uploadFill').style.width='0%';
 }
}

function setBatchProgress(done,total,currentFile,currentPct){
 const w=document.getElementById('uploadProgress');
 if(!w)return;
 w.style.display='block';
 const pct=total ? Math.min(100,Math.round(((done+currentPct/100)/total)*100)) : 0;
 document.getElementById('uploadFileName').textContent =
   total>1 ? `Uploading ${done+1} of ${total}: ${currentFile}` : currentFile;
 document.getElementById('uploadPct').textContent=pct+'%';
 document.getElementById('uploadFill').style.width=pct+'%';
}

async function getOrCreateFolder(name,parentId,parentToken){
 const key=(parentId||'ROOT')+'|'+name;
 window.batchFolderCache=window.batchFolderCache||new Map();
 if(window.batchFolderCache.has(key))return window.batchFolderCache.get(key);

 const headers={...authHeaders(),'Content-Type':'application/json'};
 if(parentToken)headers['X-Folder-Token']=parentToken;

 // Reuse an existing folder when possible.
 const qr=await fetch('/api/folders'+(parentId?'?parentId='+encodeURIComponent(parentId):''),{
   headers: parentToken ? {'Authorization':headers.Authorization,'X-Folder-Token':parentToken} : {'Authorization':headers.Authorization}
 });
 if(qr.ok){
   const existing=await qr.json();
   const found=existing.find(x=>x.name===name);
   if(found){
     if(found.protected) throw new Error(`Folder "${name}" already exists and is password protected. Open/unlock it first.`);
     window.batchFolderCache.set(key,found.id);
     return found.id;
   }
 }
 const r=await fetch('/api/folders',{
   method:'POST',
   headers,
   body:JSON.stringify({name,parentId:parentId||null,password:''})
 });
 const d=await r.json().catch(()=>({}));
 if(!r.ok){
   // Another upload/tab may have created it between the GET and POST; try once more.
   if(r.status===409){
     const rr=await fetch('/api/folders'+(parentId?'?parentId='+encodeURIComponent(parentId):''),{
       headers: parentToken ? {'Authorization':headers.Authorization,'X-Folder-Token':parentToken} : {'Authorization':headers.Authorization}
     });
     if(rr.ok){
       const list=await rr.json(), found=list.find(x=>x.name===name);
       if(found){window.batchFolderCache.set(key,found.id);return found.id;}
     }
   }
   throw new Error(d.error||`Could not create folder "${name}"`);
 }
 const id=d.folder.id;
 window.batchFolderCache.set(key,id);
 return id;
}

async function ensureRelativeFolder(relativePath){
 const parts=relativePath.split('/').filter(Boolean);
 if(!parts.length)return {id:window.currentFolder||null,token:window.currentFolderToken||null};
 let parent=window.currentFolder||null;
 let token=window.currentFolderToken||null;
 for(const part of parts){
   const id=await getOrCreateFolder(part,parent,token);
   parent=id;
   // If this folder already existed and is protected, getOrCreateFolder may return its id.
   // Unlock it so the following file upload can actually write into it.
   let nextToken=null;
   try{
     const rr=await fetch('/api/folders/'+encodeURIComponent(id)+'/unlock',{
       method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({password:''})
     });
     if(rr.ok){const dd=await rr.json();nextToken=dd.token||null;}
   }catch(e){}
   token=nextToken;
 }
 return {id:parent,token};
}

async function uploadOneChunked(file,folderId,onProgress){
  const CHUNK=3*1024*1024;
  const total=Math.max(1,Math.ceil(file.size/CHUNK));
  const uploadId=(crypto.randomUUID?crypto.randomUUID():(Date.now()+'-'+Math.random()).replace('.',''));
  const MAX_PARALLEL=4;
  let uploaded=0, nextIndex=0, failed=false;

  const sendChunk=async(index)=>{
    const blob=file.slice(index*CHUNK,Math.min(file.size,(index+1)*CHUNK));
    const fd=new FormData();
    fd.append('chunk',blob,file.name);
    fd.append('uploadId',uploadId);
    fd.append('index',String(index));
    fd.append('total',String(total));
    fd.append('name',file.name);
    fd.append('mime',file.type||'application/octet-stream');
    fd.append('size',String(file.size));
    if(folderId)fd.append('folderId',folderId);

    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST','/api/files/chunk');
      const hh=authHeaders();
      if(folderId){
        const folderToken=file.__folderToken || (window.currentFolder===folderId ? window.currentFolderToken : null);
        if(folderToken)hh['X-Folder-Token']=folderToken;
      }
      Object.keys(hh).forEach(k=>xhr.setRequestHeader(k,hh[k]));
      xhr.upload.onprogress=e=>{
        if(e.lengthComputable && onProgress)
          onProgress(Math.min(99,Math.round(((uploaded+e.loaded)/Math.max(1,file.size))*100)));
      };
      xhr.onload=()=>{
        let d={}; try{d=JSON.parse(xhr.responseText||'{}')}catch(e){}
        if(xhr.status>=200&&xhr.status<300){
          uploaded+=blob.size;
          if(onProgress)onProgress(Math.min(99,Math.round((uploaded/file.size)*100)));
          resolve(d);
        } else reject(new Error(d.error||'Upload failed'));
      };
      xhr.onerror=()=>reject(new Error('Upload failed. Please try again.'));
      xhr.ontimeout=()=>reject(new Error('Upload timed out. Please try again.'));
      xhr.send(fd);
    });
  };

  const worker=async()=>{
    while(true){
      const index=nextIndex++;
      if(index>=total || failed)return;
      try{await sendChunk(index);}
      catch(e){failed=true;throw e;}
    }
  };

  try{
    await Promise.all(Array.from({length:Math.min(MAX_PARALLEL,total)},()=>worker()));
    if(failed)throw new Error('Upload failed.');
    const r=await fetch('/api/files/chunk/complete',{
      method:'POST',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body:JSON.stringify({uploadId})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Could not finish upload');
    if(onProgress)onProgress(100);
    return d;
  }catch(e){
    // Best-effort cleanup. Expiry on the server also removes abandoned chunks.
    try{
      await fetch('/api/files/chunk/abort',{
        method:'POST',
        headers:{...authHeaders(),'Content-Type':'application/json'},
        body:JSON.stringify({uploadId})
      });
    }catch(_){}
    throw e;
  }
}

async function uploadFileBatch(files,isFolder){
 const cleanFiles=files.filter(f=>f && typeof f.size==='number');
 if(!cleanFiles.length)return;

 const w=document.getElementById('uploadProgress');
 const title=isFolder ? '📂 Uploading folder' : '📤 Uploading files';
 document.getElementById('uploadFileName').textContent=title;
 w.style.display='block';
 window.batchFolderCache=new Map();

 let done=0;
 try{
   // Multiple independent files upload together. Each file itself also
   // uploads up to 4 chunks in parallel.
   const concurrency=isFolder?1:Math.min(3,cleanFiles.length);
   let cursor=0;
   const worker=async()=>{
     while(true){
       const idx=cursor++;
       if(idx>=cleanFiles.length)return;
       const file=cleanFiles[idx];
       let targetFolder=window.currentFolder||null;
       if(isFolder){
         const rel=String(file.webkitRelativePath||'').replace(/\\/g,'/');
         const parts=rel.split('/').filter(Boolean);
         parts.pop();
         if(parts.length){
           const target=await ensureRelativeFolder(parts.join('/'));
           targetFolder=target.id;
           if(target.token) file.__folderToken=target.token;
         }
       }

       setBatchProgress(done,cleanFiles.length,file.name,0);
       await uploadOneChunked(file,targetFolder,pct=>{
         setBatchProgress(done,cleanFiles.length,file.name,pct);
       });
       done++;
       setBatchProgress(done,cleanFiles.length,file.name,100);
     }
   };
   await Promise.all(Array.from({length:concurrency},()=>worker()));
   document.getElementById('uploadPct').textContent='100% — Complete';
   document.getElementById('uploadFill').style.width='100%';
   await loadDrive();
   setTimeout(()=>showUploadProgress(false),1200);
 }catch(e){
   alert('❌ '+e.message);
   setUploadErrorState();
 }
}

function setUploadErrorState(){
 const pct=document.getElementById('uploadPct'),fill=document.getElementById('uploadFill');
 if(pct)pct.textContent='Upload stopped';
 if(fill)fill.style.width='0%';
 setTimeout(()=>showUploadProgress(false),1800);
}

function viewFile(id,name,type){const modal=document.getElementById('viewModal'),body=document.getElementById('viewBody');document.getElementById('viewTitle').textContent=name;const token=encodeURIComponent(sessionStorage.getItem('fileShareToken')||'');const ft=window.currentFolderToken?'&folderToken='+encodeURIComponent(window.currentFolderToken):'';const url='/api/files/'+id+'/view?token='+token+ft;let el;if(type.startsWith('image/'))el=document.createElement('img');else if(type.startsWith('video/')){el=document.createElement('video');el.controls=true;el.autoplay=true;}else if(type.startsWith('audio/')){el=document.createElement('audio');el.controls=true;el.autoplay=true;}else {el=document.createElement('iframe');el.style.height='78vh';el.style.border='0';el.style.background='#fff';}el.src=url;el.className='view-content';body.replaceChildren(el);modal.style.display='flex';modal.setAttribute('aria-hidden','false');}
function closeView(){const m=document.getElementById('viewModal');m.style.display='none';m.setAttribute('aria-hidden','true');document.getElementById('viewBody').replaceChildren();}
async function downloadFile(id){
 const r=await fetch("/api/files/"+id+"/download",{headers:folderHeaders()});if(!r.ok){alert("Download failed");return;}
 const b=await r.blob(),cd=r.headers.get("Content-Disposition")||"",m=cd.match(/filename\\*=UTF-8''([^;]+)/),name=m?decodeURIComponent(m[1]):"download";
 const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function deleteFile(id){if(!confirm("Delete this file?"))return;const r=await fetch("/api/files/"+id,{method:"DELETE",headers:folderHeaders()});if(r.ok)loadDrive();else alert("Delete failed");}
async function deleteFolder(id){
 const folderName=(window.driveItems||[]).find(x=>x.id===id)?.name||"this folder";
 if(!confirm("Delete this folder?\n\nIf it is password protected, a secure popup will ask for its password."))return;
 let headers=authHeaders();
 let r=await fetch("/api/folders/"+id,{method:"DELETE",headers});
 if(r.status===403){openFolderPasswordPopup({mode:"delete",id,name:folderName});return;}
 const d=await r.json().catch(()=>({}));
 if(r.ok)loadDrive();else alert("❌ "+(d.error||"Delete failed"));
}
/* ENTER KEY */

document.getElementById("passwordInput").addEventListener("keydown", function(e) {

    if (e.key === "Enter") {
        checkPassword();
    }

});


/* ================= DEVTOOLS / INSPECT BLOCK ================= */

/* Right Click */
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});


/* Keyboard Shortcuts */
document.addEventListener("keydown", function(e) {

    /* F12 */
    if (e.key === "F12") {
        e.preventDefault();
        return false;
    }

    /* Ctrl + Shift + I */
    if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === "i"
    ) {
        e.preventDefault();
        return false;
    }

    /* Ctrl + Shift + J */
    if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === "j"
    ) {
        e.preventDefault();
        return false;
    }

    /* Ctrl + Shift + C */
    if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === "c"
    ) {
        e.preventDefault();
        return false;
    }

    /* Ctrl + U */
    if (
        e.ctrlKey &&
        e.key.toLowerCase() === "u"
    ) {
        e.preventDefault();
        return false;
    }

});


/* ================= DEVTOOLS DETECTION ================= */

setInterval(function() {

    const threshold = 160;

    if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
    ) {

        document.body.innerHTML = `
            <div style="
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#111827;
                color:white;
                font-family:Arial;
                text-align:center;
            ">
                <div>
                    <h1>⚠️ Access Blocked</h1>
                    <p>Please close Developer Tools and refresh the page.</p>
                </div>
            </div>
        `;

    }

}, 1000);


/* Leaving any dashboard link clears the page session so returning asks for the password again. */
function leaveProtectedPage(){
  sessionStorage.removeItem("fileShareToken");
  sessionStorage.removeItem("linkPageUnlocked");
}

/* ================= SESSION ================= */

/* Keep password only while the protected dashboard session is active. External links clear it. */
loadLinks();

if (sessionStorage.getItem("linkPageUnlocked") === "true") {

    document.getElementById("passwordScreen").style.display = "none";
    document.getElementById("mainContent").style.display = "flex";

}


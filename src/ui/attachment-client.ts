// Only metadata/IDs enter VS Code webview state. File bytes remain in local extension storage.
export const attachmentClient=String.raw`
let consoleAttachments=Array.isArray(saved.consoleAttachments)?saved.consoleAttachments.slice(0,8):[],attachmentUploads=new Set();
const attachmentList=document.getElementById('console-attachments'),attachmentHint=document.getElementById('console-attachment-hint'),attachButton=document.getElementById('console-attach');
function attachmentState(){return consoleAttachments.map(({id,name,mime,bytes,sha256})=>({id,name,mime,bytes,sha256}));}
function attachmentError(message){consoleMessage.textContent=message;consoleMessage.className='warning';}
function renderAttachments(){
  attachmentList.replaceChildren();for(const a of consoleAttachments){const chip=document.createElement('div');chip.className='attachment-chip';if(a.preview){const image=document.createElement('img');image.src=a.preview;image.alt='';chip.append(image);}const label=document.createElement('span');label.textContent=a.name+' · '+Math.ceil(a.bytes/1024)+' KB';chip.append(label);const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title=attachmentHint.dataset.remove+' '+a.name;remove.setAttribute('aria-label',remove.title);remove.disabled=consolePending;remove.onclick=()=>{if(consolePending)return;consoleAttachments=consoleAttachments.filter(b=>b.id!==a.id);consoleRequest='';renderAttachments();persist();};chip.append(remove);attachmentList.append(chip);}
  attachButton.disabled=consolePending||attachmentUploads.size>0;consoleSend.disabled=consolePending||attachmentUploads.size>0;
  attachmentHint.textContent=attachmentUploads.size?attachmentHint.dataset.loading:attachmentHint.dataset.hint;
}
function uploadId(){return 'upload-'+crypto.randomUUID();}
async function attachFiles(files){
  if(consolePending||attachmentUploads.size)return;
  if(consoleAttachments.length+files.length>8){attachmentError(attachmentHint.dataset.limit);return;}
  for(const file of files){
    if(file.size>4*1024*1024||!file.size){attachmentError(attachmentHint.dataset.size);continue;}
    const id=uploadId();attachmentUploads.add(id);renderAttachments();
    try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});vscode.postMessage({action:'consoleAttach',uploadId:id,name:file.name||'clipboard.png',data});}
    catch{attachmentUploads.delete(id);attachmentError(attachmentHint.dataset.failed);renderAttachments();}
  }
}
attachButton.addEventListener('click',()=>{if(consolePending||attachmentUploads.size)return;const id=uploadId();attachmentUploads.add(id);renderAttachments();vscode.postMessage({action:'consolePickFiles',uploadId:id});});
const composer=document.getElementById('console-form');
composer.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();void attachFiles(files);}});
composer.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();composer.classList.add('drag-active');}});
composer.addEventListener('dragleave',e=>{if(!composer.contains(e.relatedTarget))composer.classList.remove('drag-active');});
composer.addEventListener('drop',e=>{e.preventDefault();composer.classList.remove('drag-active');void attachFiles([...e.dataTransfer.files]);});
document.addEventListener('click',e=>{const copy=e.target.closest('[data-console-copy]');if(copy)vscode.postMessage({action:'consoleCopy',sessionId:copy.dataset.sessionId,part:copy.dataset.consoleCopy});});
window.addEventListener('message',e=>{const m=e.data;if(m.type==='consoleCopied'){consoleMessage.textContent=m.message;consoleMessage.className='';}if(m.type!=='consoleAttachments')return;if(!attachmentUploads.has(m.uploadId))return;attachmentUploads.delete(m.uploadId);if(m.error)attachmentError(m.error);else if(!m.cancelled){const next=m.restore?m.attachments:[...consoleAttachments,...m.attachments.filter(a=>!consoleAttachments.some(b=>a.id===b.id))];if(next.length>8||next.reduce((sum,a)=>sum+a.bytes,0)>16*1024*1024)attachmentError(attachmentHint.dataset.limit);else{consoleAttachments=next;if(!m.restore)consoleRequest='';}}renderAttachments();persist();});
renderAttachments();
if(consoleAttachments.length){const id=uploadId();attachmentUploads.add(id);renderAttachments();vscode.postMessage({action:'consoleRestoreAttachments',uploadId:id,ids:consoleAttachments.map(a=>a.id)});}
`;

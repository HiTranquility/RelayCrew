export const demoPaneMarkup=`<dialog id="folder-dialog"><header><strong>Thư mục & quyền của phiên</strong><button id="folder-close" aria-label="Đóng">×</button></header><dl id="folder-fields"></dl><p id="folder-policy"></p><p>Trong VS Code: mở <strong>Thư mục & quyền → Task mới / chọn thư mục</strong>, chọn một hoặc nhiều folder và quyền cho từng folder trước khi gửi. Phiên đang chạy giữ nguyên thư mục đã giao.</p><div id="folder-sessions" aria-label="Chuyển phiên theo thư mục"></div></dialog>`;

export const demoPaneClient=String.raw`
function openObserver(name){
 const url='/'+name+'?id='+encodeURIComponent(selected),popup=window.open(url,'_blank','popup=yes,width=1150,height=850,resizable=yes,scrollbars=yes');
 const fallback=document.getElementById('popout-fallback');fallback.hidden=!!popup;fallback.href=url;
 if(popup){popup.opener=null;message('Đã mở '+(name==='live'?'Live':'Map')+' riêng. Đóng khung xem không dừng tác vụ. Trình duyệt có thể dùng cửa sổ hoặc tab riêng.');}
 else message('Trình duyệt chặn cửa sổ mới. Bấm “Mở khung riêng” hoặc cho phép popup cho localhost.');
}
function showFolders(){document.getElementById('folder-dialog').showModal();}
function renderFolders(job,jobs){
 document.getElementById('folder-badge').textContent=(job.scope.cwd.split(/[\\/]/).filter(Boolean).pop()||job.scope.cwd);
 document.getElementById('folder-badge').title=job.scope.cwd;
 const fields=document.getElementById('folder-fields');fields.replaceChildren();
 const permission=job.simulation?'Giả lập · không truy cập file':job.scope.readOnly||job.scope.permission==='read-only'?'Chỉ đọc':job.scope.permission==='full'?'Quyền CLI đầy đủ':'Theo chính sách CLI của đội';
 const rows=[['Phiên',job.id],['Thư mục thực thi',job.scope.cwd],['Chính sách thực thi',permission]];
 if(job.scope.sourceCwd&&job.scope.sourceCwd!==job.scope.cwd)rows.push(['Thư mục gốc',job.scope.sourceCwd]);
 if(job.scope.branch)rows.push(['Nhánh worktree',job.scope.branch]);
 for(const [name,value]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;fields.append(dt,dd);}
 document.getElementById('folder-policy').textContent=job.simulation?'Đây là phạm vi minh họa. Không đọc hoặc sửa file từ trang demo.':'Trang này chỉ quan sát bản ghi CLI. Chọn folder hay cấp quyền thực thi phải thực hiện trong VS Code trước khi tạo tác vụ mới.';
 const list=document.getElementById('folder-sessions'),signature=jobs.map(j=>j.id+':'+j.scope.cwd).join('|')+'|'+selected;
 if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren();for(const peer of jobs){const b=document.createElement('button');b.type='button';b.textContent=(peer.simulation?'Giả lập':'CLI')+' · '+peer.scope.cwd;b.setAttribute('aria-pressed',String(peer.id===selected));b.onclick=()=>{selected=peer.id;document.getElementById('folder-dialog').close();refresh();};list.append(b);}}
}
for(const b of document.querySelectorAll('[data-popout]'))b.onclick=()=>openObserver(b.dataset.popout);
for(const b of document.querySelectorAll('[data-hide-pane]'))b.onclick=()=>view(b.dataset.hidePane==='map'?'live':'map');
document.getElementById('folders').onclick=showFolders;document.getElementById('folder-close').onclick=()=>document.getElementById('folder-dialog').close();
`;

export const demoPaneStyles=String.raw`
.observer-pane{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}.observer-pane>header{padding:7px 10px;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--demo-border);min-height:46px}.observer-pane>header>strong{margin-right:auto;font-size:13px}.observer-pane>header button{font-size:12px;padding:5px 9px}.observer-pane iframe{flex:1;min-height:0}main[data-view=map] #live-pane,main[data-view=live] #map-pane{display:none}#folders{display:flex;align-items:center;gap:7px;max-width:360px}#folder-badge{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--demo-muted)}#folder-dialog dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 16px}#folder-dialog dt{color:var(--demo-muted)}#folder-dialog dd{margin:0;overflow-wrap:anywhere}#folder-sessions{display:grid;gap:8px}#folder-sessions button{text-align:left;overflow-wrap:anywhere}#folder-sessions [aria-pressed=true]{border-color:var(--demo-accent)}#popout-fallback{border-color:var(--demo-warn)}@media(max-width:850px){.more-menu{position:fixed;left:12px;right:12px;top:auto;margin-top:8px;min-width:0}.observer-pane{min-height:650px}.observer-pane iframe{height:650px;flex:auto}#folders{max-width:100%}#folder-dialog dl{grid-template-columns:1fr}#folder-dialog dd{margin-bottom:5px}}
`;

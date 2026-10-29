(function(root){
  'use strict';
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const statusLabels={new:'Awaiting review',approved:'Approved',rejected:'Rejected',uploading:'Upload incomplete'};
  function submissionPage(rows, {status='new',search='',page=0,pageSize=10}={}) {
    const matches=rows.filter(row=>(status==='all'||row.status===status)&&`${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt))||String(a.id).localeCompare(String(b.id)));
    const pages=Math.max(1,Math.ceil(matches.length/pageSize));
    const current=Math.min(Math.max(0,page),pages-1);
    return {rows:matches.slice(current*pageSize,(current+1)*pageSize),total:matches.length,page:current,pages};
  }
  let pdfRendererPromise;
  function loadPdfRenderer() {
    if(!pdfRendererPromise)pdfRendererPromise=import('/src/vendor/pdfjs/pdf.mjs').then(renderer=>{
      renderer.GlobalWorkerOptions.workerSrc='/src/vendor/pdfjs/pdf.worker.mjs';return renderer;
    }).catch(error=>{pdfRendererPromise=null;throw error;});
    return pdfRendererPromise;
  }
  async function previewPdf(client,row) {
    const viewer=document.createElement('dialog');viewer.className='work-dialog sepa-pdf-dialog';
    let url='',loadingTask=null,renderTask=null,pdf=null,pageNumber=1,zoom=1,rendering=false;
    viewer.innerHTML=`<div class="section-head"><h3>Signed mandate · ${escape(row.firstName)} ${escape(row.lastName)}</h3><button type="button" class="ghost-button" data-preview-close>Close preview</button></div><div data-preview-content class="work-status" role="status"><span class="work-spinner" aria-hidden="true"></span>Loading private PDF…</div>`;
    viewer.querySelector('[data-preview-close]').onclick=()=>viewer.close();
    viewer.addEventListener('close',()=>{
      renderTask?.cancel();
      if(loadingTask)void loadingTask.destroy().catch(()=>{});
      if(url)URL.revokeObjectURL(url);viewer.remove();
    },{once:true});
    document.body.append(viewer);viewer.showModal();
    try {
      const result=await client.runAdminTask({task:'sepaReview',action:'download',submissionId:row.id});
      if(!viewer.isConnected)return;
      const bytes=Uint8Array.from(atob(result.pdfBase64),char=>char.charCodeAt(0));
      url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      const content=viewer.querySelector('[data-preview-content]');content.className='sepa-pdf-content';
      content.innerHTML=`<p class="meta"><a href="${url}" target="_blank" rel="noopener noreferrer">Open original PDF in a browser tab</a></p><div class="button-row sepa-pdf-controls"><button type="button" class="ghost-button small-button" data-pdf-previous disabled>Previous page</button><span data-pdf-page role="status">Loading…</span><button type="button" class="ghost-button small-button" data-pdf-next disabled>Next page</button><button type="button" class="ghost-button small-button" data-pdf-out disabled>−</button><button type="button" class="ghost-button small-button" data-pdf-in disabled>+</button><button type="button" class="ghost-button small-button" data-pdf-fit disabled>Fit to width</button></div><p data-pdf-error class="work-error" role="alert"></p><div class="sepa-pdf-pages"><canvas aria-label="Signed mandate page" role="img"></canvas></div>`;
      const renderer=await loadPdfRenderer();
      if(!viewer.isConnected)return;
      loadingTask=renderer.getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:'/src/vendor/pdfjs/standard_fonts/',cMapUrl:'/src/vendor/pdfjs/cmaps/',cMapPacked:true,wasmUrl:'/src/vendor/pdfjs/wasm/'});
      pdf=await loadingTask.promise;
      if(!viewer.isConnected)return;
      const controls=content.querySelectorAll('.sepa-pdf-controls button');
      async function draw() {
        if(rendering||!viewer.isConnected)return;
        rendering=true;controls.forEach(button=>{button.disabled=true;});
        try {
          const page=await pdf.getPage(pageNumber);
          if(!viewer.isConnected)return;
          const host=content.querySelector('.sepa-pdf-pages'),canvas=content.querySelector('canvas');
          const base=page.getViewport({scale:1});
          const viewport=page.getViewport({scale:Math.max(240,host.clientWidth-24)/base.width*zoom});
          const ratio=Math.min(window.devicePixelRatio||1,2);
          canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
          canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
          canvas.setAttribute('aria-label',`Signed mandate, page ${pageNumber} of ${pdf.numPages}`);
          renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
          await renderTask.promise;renderTask=null;
          content.querySelector('[data-pdf-page]').textContent=`Page ${pageNumber} of ${pdf.numPages} · ${Math.round(zoom*100)}%`;
          content.querySelector('[data-pdf-error]').textContent='';
        } catch(error) {if(viewer.isConnected)content.querySelector('[data-pdf-error]').textContent=error.message||'This PDF page could not be displayed.';}
        finally {
          rendering=false;
          if(viewer.isConnected){controls.forEach(button=>{button.disabled=false;});content.querySelector('[data-pdf-previous]').disabled=pageNumber<=1;content.querySelector('[data-pdf-next]').disabled=pageNumber>=pdf.numPages;}
        }
      }
      content.querySelector('[data-pdf-previous]').onclick=()=>{if(!rendering&&pageNumber>1){pageNumber--;void draw();}};
      content.querySelector('[data-pdf-next]').onclick=()=>{if(!rendering&&pageNumber<pdf.numPages){pageNumber++;void draw();}};
      content.querySelector('[data-pdf-out]').onclick=()=>{if(!rendering){zoom=Math.max(.5,zoom-.25);void draw();}};
      content.querySelector('[data-pdf-in]').onclick=()=>{if(!rendering){zoom=Math.min(3,zoom+.25);void draw();}};
      content.querySelector('[data-pdf-fit]').onclick=()=>{if(!rendering){zoom=1;void draw();}};
      await draw();
    } catch(error) {
      if(viewer.isConnected){const errorBox=viewer.querySelector('[data-pdf-error]')||viewer.querySelector('[data-preview-content]');errorBox.textContent=error.message||'Could not load PDF.';}
    }
  }
  async function open({client,onApplied,onReviewed}){
    const dialog=document.createElement('dialog');dialog.className='work-dialog sepa-admin-dialog';dialog.setAttribute('aria-label','SEPA overview');
    let data=null,filter='attention',includeInactive=false,search='',busy=false,notice='',submissionStatus='new',submissionSearch='',page=0,checklistOpen=false;
    function shell(content){dialog.innerHTML=`<div class="section-head"><div><p class="eyebrow">Finance</p><h2>SEPA & bank details</h2></div><button type="button" data-sepa-close class="ghost-button">Close</button></div><p><a class="ghost-button" href="/sepa.html" target="_blank" rel="noopener noreferrer">Open public submission form</a> <button type="button" data-sepa-copy class="ghost-button">Copy form link</button></p>${notice?`<p class="work-error" role="alert">${escape(notice)}</p>`:''}${content}`;
      dialog.querySelector('[data-sepa-close]').onclick=()=>dialog.close();
      dialog.querySelector('[data-sepa-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/sepa.html`);dialog.querySelector('[data-sepa-copy]').textContent='Link copied';}catch{notice='Copy this link: '+location.origin+'/sepa.html';render();}};
    }
    async function load(){if(busy)return;busy=true;shell('<p class="work-status" role="status"><span class="work-spinner" aria-hidden="true"></span>Loading private SEPA overview…</p>');
      try{data=await client.runAdminTask({task:'sepaReview',action:'overview'});notice='';}
      catch(error){notice=error.message||'The overview could not be loaded.';}
      finally{busy=false;render();}
    }
    function render(){
      if(!data){shell('<button type="button" data-sepa-retry class="primary-button">Retry loading</button>');dialog.querySelector('[data-sepa-retry]').onclick=load;return;}
      const pending=data.submissions.filter(row=>row.status==='new');
      const pendingFor=id=>pending.filter(row=>row.memberId===id);
      const members=data.members.filter(member=>includeInactive||!['inactive','exited','exit','coach'].includes(member.membershipStatus.toLowerCase()));
      const missingIban=members.filter(row=>!row.ibanPresent),missingDate=members.filter(row=>!row.mandateDatePresent),missingDocument=members.filter(row=>!row.documentPresent);
      const visible=members.filter(row=>{
        if(search&&!row.name.toLowerCase().includes(search.toLowerCase()))return false;
        if(filter==='iban')return !row.ibanPresent;if(filter==='date')return !row.mandateDatePresent;if(filter==='document')return !row.documentPresent;
        if(filter==='pending')return pendingFor(row.id).length>0;
        return filter==='all'||!row.ibanPresent||!row.mandateDatePresent||!row.documentPresent;
      });
      const resultPage=submissionPage(data.submissions,{status:submissionStatus,search:submissionSearch,page});page=resultPage.page;const submissions=resultPage.rows;
      shell(`<div class="tryout-pipeline"><span class="pill">${members.length} members</span><span class="pill">${missingIban.length} missing valid IBAN</span><span class="pill">${missingDate.length} missing signature date</span><span class="pill">${missingDocument.length} no document in this app</span><span class="pill">${pending.length} awaiting review</span></div>
        <p class="meta">An uploaded document is checked by Finance before bank details are applied. Older mandates held in Google Drive are not automatically imported. This checklist does not determine payment status or guarantee that a mandate is valid.</p>
        <h3>Mandate submissions (${resultPage.total})</h3>
        <div class="work-form-grid"><label>Find a submission<input data-sepa-submission-search value="${escape(submissionSearch)}" placeholder="Name or contact email"></label><label>Submission status<select data-sepa-status>${[['new','Awaiting review'],['approved','Approved'],['rejected','Rejected'],['uploading','Upload incomplete'],['all','All submissions']].map(([value,label])=>`<option value="${value}" ${submissionStatus===value?'selected':''}>${label} (${value==='all'?data.submissions.length:data.submissions.filter(row=>row.status===value).length})</option>`).join('')}</select></label></div><p class="meta">Names are matched without relying on the contact email. Check the selected member and the signed document before approving.</p>
        <div class="sepa-submission-list">${submissions.map(row=>`<details class="setup-card sepa-submission" data-sepa-submission="${escape(row.id)}"><summary><span><strong>${escape(row.firstName)} ${escape(row.lastName)}</strong><span class="meta">${escape(statusLabels[row.status]||row.status)} · ${escape(String(row.submittedAt||'').slice(0,10))}${!row.memberId?' · Member not assigned':''}</span></span><button type="button" class="ghost-button small-button" data-sepa-preview ${row.status==='uploading'?'disabled':''}>View signed PDF</button></summary><div class="sepa-submission-detail"><p class="meta">Received ${escape(row.submittedAt)} · Contact: ${escape(row.email)}</p><p>Account holder: ${escape(row.accountHolder)}<br>IBAN: ${escape(row.iban)}<br>Signed: ${escape(row.signedOn)} · Joined approximately: ${escape(row.joinedOn)}</p><p class="meta">${row.collectionAgreed ? `Seven-day notice period agreed (version ${escape(row.collectionAgreementVersion)}).` : "No seven-day notice agreement recorded with this submission."}</p><label>Assigned member<select data-sepa-member ${row.status==='approved'?'disabled':''}><option value="">Select the correct member</option>${data.members.map(member=>`<option value="${escape(member.id)}" ${row.memberId===member.id?'selected':''}>${escape(member.name)} (${escape(member.membershipStatus)})</option>`).join('')}</select></label>
          <div class="button-row"><button type="button" class="ghost-button" data-sepa-download ${row.status==='uploading'?'disabled':''}>Download signed PDF</button></div>
          ${row.status==='new'?`<label class="status-check"><input type="checkbox" data-sepa-checked>I checked the signed document, account holder, IBAN, signature date and member assignment.</label><div class="button-row"><button type="button" class="primary-button" data-sepa-approve>Approve & apply bank details</button><button type="button" class="ghost-button danger-button" data-sepa-reject>Reject submission</button></div>`:''}
        </div></details>`).join('')||'<p>No submissions match this filter.</p>'}</div><div class="button-row"><button type="button" data-sepa-previous class="ghost-button" ${page===0?'disabled':''}>Previous</button><span class="meta">Page ${page+1} of ${resultPage.pages} · ${resultPage.total} submissions</span><button type="button" data-sepa-next class="ghost-button" ${page+1>=resultPage.pages?'disabled':''}>Next</button></div><details class="sepa-member-checklist" ${checklistOpen?'open':''}><summary><strong>Member checklist & missing bank details (${visible.length})</strong></summary>        <div class="work-form-grid"><label>Find a player<input data-sepa-search value="${escape(search)}" placeholder="Player name"></label><label>Show<select data-sepa-filter>${[['attention','Needs attention'],['iban','Missing valid IBAN'],['date','Missing signature date'],['document','No document in this app'],['pending','New submission received'],['all','All members']].map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${label}</option>`).join('')}</select></label></div>
        <label class="status-check"><input type="checkbox" data-sepa-inactive ${includeInactive?'checked':''}>Include inactive, exited and coach records</label>
        <h3>Member checklist (${visible.length})</h3><div class="sepa-checklist">${visible.map(member=>`<article class="sepa-member-row"><strong>${escape(member.name)}</strong><span>${escape(member.membershipStatus)}</span><span>${member.ibanPresent?'IBAN ending '+escape(member.ibanEnding):'IBAN missing or invalid'}</span><span>${member.mandateDatePresent?'Signature date on file':'Signature date missing'}</span><span>${member.documentPresent?'Document linked':'No document in this app'}</span>${pendingFor(member.id).length?'<span class="pill">Submission received — review below</span>':''}</article>`).join('')||'<p>No members match this filter.</p>'}</div>
</details><button type="button" data-sepa-refresh class="ghost-button">Refresh overview</button>`);
      dialog.querySelector('[data-sepa-status]').onchange=event=>{submissionStatus=event.target.value;page=0;render();};
      dialog.querySelector('[data-sepa-submission-search]').onchange=event=>{submissionSearch=event.target.value;page=0;render();};
      dialog.querySelector('[data-sepa-previous]').onclick=()=>{page--;render();dialog.scrollTop=0;};
      dialog.querySelector('[data-sepa-next]').onclick=()=>{page++;render();dialog.scrollTop=0;};
      dialog.querySelector('.sepa-member-checklist').ontoggle=event=>{checklistOpen=event.target.open;};
      dialog.querySelector('[data-sepa-filter]').onchange=event=>{filter=event.target.value;render();};
      dialog.querySelector('[data-sepa-inactive]').onchange=event=>{includeInactive=event.target.checked;render();};
      dialog.querySelector('[data-sepa-search]').onchange=event=>{search=event.target.value;render();};
      dialog.querySelector('[data-sepa-refresh]').onclick=load;
      dialog.querySelectorAll('[data-sepa-submission]').forEach(card=>{
        const row=data.submissions.find(item=>item.id===card.dataset.sepaSubmission);
        card.querySelector('[data-sepa-preview]').onclick=event=>{event.preventDefault();event.stopPropagation();void previewPdf(client,row);};
        const download=card.querySelector('[data-sepa-download]');
        download.onclick=async()=>{
          download.disabled=true;download.textContent='Loading private PDF…';
          try{const result=await client.runAdminTask({task:'sepaReview',action:'download',submissionId:row.id});const bytes=Uint8Array.from(atob(result.pdfBase64),char=>char.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=result.fileName;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
          catch(error){notice=error.message;render();}finally{download.disabled=false;download.textContent='Download signed PDF';}
        };
        for(const action of ['approve','reject']){const button=card.querySelector(`[data-sepa-${action}]`);if(!button)continue;button.onclick=async()=>{
          if(busy)return;
          const memberId=card.querySelector('[data-sepa-member]').value;
          const member=data.members.find(item=>item.id===memberId);
          if(action==='approve'&&(!member||!card.querySelector('[data-sepa-checked]').checked)){notice='Select the correct member and confirm that you checked the signed mandate.';render();return;}
          if(!window.confirm(action==='approve'?`Apply the verified IBAN ending ${row.iban.slice(-4)} and signature date ${row.signedOn} to ${member.name}? Existing bank details will be replaced. No payment will be initiated.`:'Reject this submission? The document remains stored for review.'))return;
          busy=true;button.disabled=true;button.textContent='Saving…';
          try{const result=await client.runAdminTask({task:'sepaReview',action,submissionId:row.id,memberId});if(action==='approve')onApplied?.({memberId,iban:row.iban,mandateDate:row.signedOn,accountHolder:row.accountHolder});if(!result.warning)onReviewed?.();notice=result.warning||'';busy=false;if(result.warning){render();}else await load();}
          catch(error){busy=false;notice=error.message||'The review could not be saved. Refresh before retrying.';render();}
        };}
      });
    }
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();await load();
  }
  root.ClubHubModules=root.ClubHubModules||{};root.ClubHubModules.sepaIntake={open,submissionPage};
})(window);

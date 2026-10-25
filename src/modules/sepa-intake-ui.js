(function(root){
  'use strict';
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const statusLabels={new:'Awaiting review',approved:'Approved',rejected:'Rejected',uploading:'Upload incomplete'};
  async function open({client,onApplied}){
    const dialog=document.createElement('dialog');dialog.className='work-dialog sepa-admin-dialog';dialog.setAttribute('aria-label','SEPA overview');
    let data=null,filter='attention',includeInactive=false,search='',busy=false,notice='';
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
      const submissions=data.submissions.filter(row=>!search||`${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
      shell(`<div class="tryout-pipeline"><span class="pill">${members.length} members</span><span class="pill">${missingIban.length} missing valid IBAN</span><span class="pill">${missingDate.length} missing signature date</span><span class="pill">${missingDocument.length} no document in this app</span><span class="pill">${pending.length} awaiting review</span></div>
        <p class="meta">An uploaded document is checked by Finance before bank details are applied. Older mandates held in Google Drive are not automatically imported. This checklist does not determine payment status or guarantee that a mandate is valid.</p>
        <div class="work-form-grid"><label>Find a player<input data-sepa-search value="${escape(search)}" placeholder="Player name"></label><label>Show<select data-sepa-filter>${[['attention','Needs attention'],['iban','Missing valid IBAN'],['date','Missing signature date'],['document','No document in this app'],['pending','New submission received'],['all','All members']].map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${label}</option>`).join('')}</select></label></div>
        <label class="status-check"><input type="checkbox" data-sepa-inactive ${includeInactive?'checked':''}>Include inactive, exited and coach records</label>
        <h3>Member checklist (${visible.length})</h3><div class="sepa-checklist">${visible.map(member=>`<article class="sepa-member-row"><strong>${escape(member.name)}</strong><span>${escape(member.membershipStatus)}</span><span>${member.ibanPresent?'IBAN ending '+escape(member.ibanEnding):'IBAN missing or invalid'}</span><span>${member.mandateDatePresent?'Signature date on file':'Signature date missing'}</span><span>${member.documentPresent?'Document linked':'No document in this app'}</span>${pendingFor(member.id).length?'<span class="pill">Submission received — review below</span>':''}</article>`).join('')||'<p>No members match this filter.</p>'}</div>
        <h3>Mandate submissions (${submissions.length})</h3><p class="meta">Names are matched without relying on the contact email. Check the selected member and the signed document before approving.</p>
        <div class="sepa-submission-list">${submissions.map(row=>`<article class="setup-card" data-sepa-submission="${escape(row.id)}"><h4>${escape(row.firstName)} ${escape(row.lastName)} · ${escape(statusLabels[row.status]||row.status)}</h4><p class="meta">Received ${escape(row.submittedAt)} · Contact: ${escape(row.email)}</p><p>Account holder: ${escape(row.accountHolder)}<br>IBAN: ${escape(row.iban)}<br>Signed: ${escape(row.signedOn)} · Joined approximately: ${escape(row.joinedOn)}</p><label>Assigned member<select data-sepa-member ${row.status==='approved'?'disabled':''}><option value="">Select the correct member</option>${data.members.map(member=>`<option value="${escape(member.id)}" ${row.memberId===member.id?'selected':''}>${escape(member.name)} (${escape(member.membershipStatus)})</option>`).join('')}</select></label>
          <div class="button-row"><button type="button" class="ghost-button" data-sepa-download ${row.status==='uploading'?'disabled':''}>Download signed PDF</button></div>
          ${row.status==='new'?`<label class="status-check"><input type="checkbox" data-sepa-checked>I checked the signed document, account holder, IBAN, signature date and member assignment.</label><div class="button-row"><button type="button" class="primary-button" data-sepa-approve>Approve & apply bank details</button><button type="button" class="ghost-button danger-button" data-sepa-reject>Reject submission</button></div>`:''}
        </article>`).join('')||'<p>No submissions yet.</p>'}</div><button type="button" data-sepa-refresh class="ghost-button">Refresh overview</button>`);
      dialog.querySelector('[data-sepa-filter]').onchange=event=>{filter=event.target.value;render();};
      dialog.querySelector('[data-sepa-inactive]').onchange=event=>{includeInactive=event.target.checked;render();};
      dialog.querySelector('[data-sepa-search]').onchange=event=>{search=event.target.value;render();};
      dialog.querySelector('[data-sepa-refresh]').onclick=load;
      dialog.querySelectorAll('[data-sepa-submission]').forEach(card=>{
        const row=data.submissions.find(item=>item.id===card.dataset.sepaSubmission);
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
          try{const result=await client.runAdminTask({task:'sepaReview',action,submissionId:row.id,memberId});if(action==='approve')onApplied?.({memberId,iban:row.iban,mandateDate:row.signedOn,accountHolder:row.accountHolder});notice=result.warning||'';busy=false;if(result.warning){render();}else await load();}
          catch(error){busy=false;notice=error.message||'The review could not be saved. Refresh before retrying.';render();}
        };}
      });
    }
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();await load();
  }
  root.ClubHubModules=root.ClubHubModules||{};root.ClubHubModules.sepaIntake={open};
})(window);

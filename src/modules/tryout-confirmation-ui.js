(function(root){
  'use strict';
  async function open(client) {
    const dialog=document.createElement('dialog');dialog.className='work-dialog';dialog.setAttribute('aria-label','Automatic registration email');
    dialog.innerHTML='<div class="section-head"><h3>Automatic registration email</h3><button type="button" class="ghost-button" data-confirmation-close>Close</button></div><p class="work-status" role="status"><span class="work-spinner" aria-hidden="true"></span>Loading current template…</p>';
    dialog.querySelector('[data-confirmation-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
    const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    async function load(){
      try {
        const template=await client.runAdminTask({task:'tryoutConfirmation',action:'load'});
        if(!dialog.isConnected)return;
        dialog.innerHTML=`<div class="section-head"><h3>Automatic registration email</h3><button type="button" class="ghost-button" data-confirmation-close>Close</button></div><p>This message is sent automatically immediately after a new tryout registration. Saving applies to future new registrations only. To contact people who already registered, use Bulk email.</p><p class="meta">Placeholders: {{firstName}}, {{lastName}}, {{email}}, {{tryoutDate}} (German), {{tryoutDateEn}} (English). Dates follow Next tryout. Club branding and the standard footer are added automatically.</p><form data-confirmation-form style="display:grid;gap:14px"><label>Subject<input name="subject" maxlength="255" required value="${escape(template.subject)}"></label><label>Message<textarea name="message" rows="16" maxlength="12000" required>${escape(template.body)}</textarea></label><details><summary>Preview with example recipient</summary><h4 data-confirmation-preview-subject></h4><pre data-confirmation-preview style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit"></pre></details><p data-confirmation-status role="status" aria-live="polite"></p><button type="submit" class="primary-button">Save automatic registration email</button></form>`;
        dialog.querySelector('[data-confirmation-close]').onclick=()=>dialog.close();
        const form=dialog.querySelector('[data-confirmation-form]'),subject=form.elements.subject,body=form.elements.message,status=dialog.querySelector('[data-confirmation-status]'),save=form.querySelector('[type="submit"]');
        function preview(){const values={...template.values,firstName:'Rookie',lastName:'Example',email:'rookie@example.invalid'};const fill=text=>text.replace(/{{(\w+)}}/g,(match,key)=>values[key]??match);dialog.querySelector('[data-confirmation-preview-subject]').textContent=fill(subject.value);dialog.querySelector('[data-confirmation-preview]').textContent=fill(body.value);}
        subject.oninput=preview;body.oninput=preview;preview();
        form.onsubmit=async event=>{
          event.preventDefault();if(save.disabled||!form.reportValidity())return;
          save.disabled=true;save.textContent='Saving…';status.textContent='';
          try{await client.runAdminTask({task:'tryoutConfirmation',action:'save',subject:subject.value,body:body.value});status.className='';status.textContent='Saved. New registrations will receive this message from now on. No emails were sent by saving.';}
          catch(error){status.className='work-error';status.textContent=error.message||'The template could not be saved. Your edits are still here.';}
          finally{save.disabled=false;save.textContent='Save automatic registration email';}
        };
      }catch(error){if(!dialog.isConnected)return;const loading=dialog.querySelector('.work-status');loading.className='work-error';loading.textContent=error.message||'Template could not be loaded.';const retry=document.createElement('button');retry.type='button';retry.className='ghost-button';retry.textContent='Retry';retry.onclick=()=>{retry.remove();loading.className='work-status';loading.textContent='Loading…';void load();};dialog.append(retry);}
    }
    await load();
  }
  root.ClubHubModules=root.ClubHubModules||{};root.ClubHubModules.tryoutConfirmation={open};
})(window);

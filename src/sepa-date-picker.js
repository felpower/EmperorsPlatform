/* Progressive enhancement: native date fields remain the no-JavaScript fallback. */
(() => {
  'use strict';
  const months = Array.from({length:12}, (_,m) => new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,m,1))));
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
  const pad = n => String(n).padStart(2,'0');
  document.querySelectorAll('#sepa-form input[type="date"], #sepa-form input[type="month"], #exit-form input[name="signed_on"], #join-form input[type="date"]').forEach((input,index) => {
    const monthOnly = input.type === 'month';
    const title = input.closest('#join-form') ? 'Transfer date' : input.closest('#exit-form') ? 'Signature date on the declaration' : monthOnly ? 'Joining month and year' : 'Signature date on the mandate';
    let year, month;
    const trigger = document.createElement('button');
    trigger.type='button'; trigger.className='sepa-date-trigger';
    trigger.setAttribute('aria-haspopup','dialog'); trigger.setAttribute('aria-label',`Choose ${title.toLowerCase()}`);
    const valueText=document.createElement('span'), icon=document.createElement('span');
    icon.textContent='▦'; icon.setAttribute('aria-hidden','true'); trigger.append(valueText,icon);
    input.classList.add('sepa-date-native'); input.tabIndex=-1; input.setAttribute('aria-hidden','true');
    input.insertAdjacentElement('afterend',trigger);
    const dialog=document.createElement('dialog'); dialog.className='sepa-calendar';
    dialog.setAttribute('aria-label',title);dialog.id=`sepa-calendar-${index}`;trigger.setAttribute('aria-controls',dialog.id);
    const heading=document.createElement('h2');heading.textContent=title;
    const controls=document.createElement('div');controls.className='sepa-calendar-controls';
    const monthSelect=document.createElement('select');monthSelect.setAttribute('aria-label','Month');
    months.forEach((name,m)=>monthSelect.add(new Option(name,String(m))));
    const yearSelect=document.createElement('select');yearSelect.setAttribute('aria-label','Year');
    const lastYear=Number(today.slice(0,4))+(monthOnly?5:0);
    for(let y=lastYear;y>=1900;y--) yearSelect.add(new Option(String(y),String(y)));
    controls.append(monthSelect,yearSelect);monthSelect.hidden=monthOnly;
    const grid=document.createElement('div');grid.className=monthOnly?'sepa-month-grid':'sepa-day-grid';
    const footer=document.createElement('div');footer.className='sepa-calendar-footer';
    const clear=document.createElement('button');clear.type='button';clear.textContent='Clear';
    const close=document.createElement('button');close.type='button';close.textContent='Cancel';
    footer.append(clear,close);dialog.append(heading,controls,grid,footer);document.body.append(dialog);
    function refreshLabel(){
      const parts=input.value.split('-').map(Number);
      valueText.textContent=input.value ? `${monthOnly?'':parts[2]+' '}${months[parts[1]-1]} ${parts[0]}` : (monthOnly?'Choose month and year':'Choose signature date');
      trigger.classList.toggle('has-value',Boolean(input.value));trigger.setAttribute('aria-expanded',String(dialog.open));
    }
    function finish(value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();}
    function render(){
      monthSelect.value=String(month);yearSelect.value=String(year);grid.replaceChildren();
      if(!monthOnly) ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(day=>{const label=document.createElement('span');label.textContent=day;label.className='sepa-weekday';grid.append(label);});
      const count=monthOnly?12:new Date(Date.UTC(year,month+1,0)).getUTCDate();
      const offset=monthOnly?0:(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
      for(let n=0;n<count;n++){
        const button=document.createElement('button');button.type='button';
        const value=monthOnly?`${year}-${pad(n+1)}`:`${year}-${pad(month+1)}-${pad(n+1)}`;
        button.textContent=monthOnly?months[n].slice(0,3):String(n+1);
        button.setAttribute('aria-label',monthOnly?`${months[n]} ${year}`:`${n+1} ${months[month]} ${year}`);
        button.setAttribute('aria-pressed',String(input.value===value));
        if(!monthOnly && value===today)button.setAttribute('aria-current','date');
        if(!monthOnly && value>today)button.disabled=true;
        if(!monthOnly && n===0)button.style.gridColumnStart=String(offset+1);
        button.onclick=()=>finish(value);grid.append(button);
      }
      const buttons=[...grid.querySelectorAll('button:not(:disabled)')];
      const selected=buttons.find(b=>b.getAttribute('aria-pressed')==='true')||buttons.find(b=>b.hasAttribute('aria-current'))||buttons[0];
      buttons.forEach(b=>b.tabIndex=b===selected?0:-1);
    }
    function open(){
      if(dialog.open)return;
      const parts=(input.value||today).split('-').map(Number);year=parts[0];month=parts[1]-1;
      render();dialog.showModal();refreshLabel();
      grid.querySelector('button[tabindex="0"]')?.focus();
    }
    trigger.onclick=open;
    input.addEventListener('invalid',event=>{event.preventDefault();if(!document.querySelector('.sepa-calendar[open]'))open();});
    input.addEventListener('change',refreshLabel);
    monthSelect.onchange=()=>{month=Number(monthSelect.value);render();};
    yearSelect.onchange=()=>{year=Number(yearSelect.value);render();};
    grid.onkeydown=event=>{
      const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:monthOnly?-3:-7,ArrowDown:monthOnly?3:7};
      if(!(event.key in steps))return;
      const buttons=[...grid.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);
      if(i<0)return;event.preventDefault();const next=buttons[Math.max(0,Math.min(buttons.length-1,i+steps[event.key]))];
      buttons.forEach(b=>b.tabIndex=b===next?0:-1);next.focus();
    };
    clear.onclick=()=>finish('');close.onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>{refreshLabel();trigger.focus();});
    refreshLabel();
  });
})();

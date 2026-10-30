/* Shared date and policy rules. No automatic payment or legal approval. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmperorsExitRules=factory();})(typeof window==='object'?window:this,function(){
  'use strict';
  const VERSION='2026-10-30-v1';
  const POLICY='Bei einem Wiedereintritt innerhalb von zwölf Monaten ab Wirksamkeit des Austritts sind grundsätzlich die regulären Mitgliedsbeiträge für den Zeitraum zwischen Austritt und Wiedereintritt nachzuzahlen. Das nach den Statuten zuständige Vereinsorgan kann aus sachlichen Gründen eine vollständige oder teilweise Befreiung gewähren, insbesondere zur Berücksichtigung ehrenamtlicher Tätigkeiten für den Verein. Die Entscheidung und ein gegebenenfalls zu zahlender Betrag werden vor dem Wiedereintritt schriftlich mitgeteilt.';
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
  const validDate=value=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}};
  const quarterStart=period=>{const m=/^Q([1-4])_(\d{4})$/.exec(String(period));return m?`${m[2]}-${['02','05','08','11'][Number(m[1])-1]}-01`:'';};
  const isBoundary=date=>validDate(date)&&['02-01','05-01','08-01','11-01'].includes(date.slice(5));
  function nextBoundaries(from=today(),count=8){const y=Number(from.slice(0,4));const all=[];for(let year=y;year<=y+3;year++)for(let q=1;q<=4;q++){const date=quarterStart(`Q${q}_${year}`);if(date>from)all.push({date,period:`Q${q}_${year}`});}return all.slice(0,count);}
  const anniversary=date=>{if(!validDate(date))return '';return `${Number(date.slice(0,4))+1}${date.slice(4)}`;};
  const excluded=(effective,period)=>isBoundary(effective)&&Boolean(quarterStart(period))&&quarterStart(period)>=effective;
  const needsReview=(effective,rejoin)=>isBoundary(effective)&&validDate(rejoin)&&rejoin>=effective&&rejoin<anniversary(effective);
  return {VERSION,POLICY,today,validDate,quarterStart,isBoundary,nextBoundaries,anniversary,excluded,needsReview};
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('interrupted bulk send keeps confirmed results and never retries the uncertain address', async () => {
  const source = fs.readFileSync('app.bundle.js','utf8');
  const code = source.slice(source.indexOf('  async function performTryoutEmailSend('),source.indexOf('  async function convertTryoutToMember('));
  let requests=0, saves=0;
  const ctx = {
    tryoutEmailSending:false,tryoutEmailResult:null,tryoutEmailRetryMessage:null,tryoutEmailRetryRecipients:[],tryoutStatusRetryIds:[],
    tryoutSubmissions:[{id:'one',status:'new'},{id:'two',status:'new'},{id:'three',status:'new'}],selectedTryoutSubmissionIds:[],
    document:{getElementById:()=>({textContent:''})},showBlockingProgress(){},hideBlockingProgress(){},showToast(){},mount(){},
    saveTryoutEmailOutcome(){saves++;},
    async sendTryoutEmailsViaFunction({recipients}) {
      requests++;
      assert.equal(recipients.length,1);
      if(requests===2)throw Error('connection interrupted');
      return {sentCount:1,failedCount:0,sent:[recipients[0]],failed:[],statusFailures:[],statusUpdatedIds:['one']};
    }
  };
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await ctx.performTryoutEmailSend(['one','two','three'].map(id=>({id,email:id+'@example.invalid'})),{subject:'test',bodyTemplate:'test'});
  assert.equal(requests,2);assert.equal(ctx.tryoutEmailResult.sentCount,1);
  assert.equal(ctx.tryoutEmailResult.uncertain[0].id,'two');
  assert.equal(ctx.tryoutEmailResult.notAttempted[0].id,'three');
  assert.equal(ctx.tryoutEmailRetryRecipients.length,0);
  assert.equal(ctx.tryoutSubmissions[0].status,'invited');assert.ok(saves>=2);
  assert.equal(ctx.tryoutEmailSending,false);
});

test('provider connection failures are uncertain, explicit rejections are retryable', async () => {
  const runtime = require('../appwrite/functions/admin/src/shared/runtime');
  const original = {...runtime},oldFetch=global.fetch,oldEnv={...process.env};
  Object.assign(process.env,{MAILGUN_API_KEY:'test',MAILGUN_DOMAIN:'example.invalid',MAILGUN_FROM_EMAIL:'test@example.invalid'});
  runtime.appwriteConfig=()=>({databaseId:'test'});
  const filename=require.resolve('../appwrite/functions/admin/src/tasks/tryoutEmail');delete require.cache[filename];
  const send=require(filename);
  const context={req:{body:{subject:'Test',bodyTemplate:'Hello',recipients:[{email:'one@example.invalid'},{email:'ONE@example.invalid'}]}},res:{json:payload=>payload},log(){}};
  try {
    let calls=0;global.fetch=async()=>{calls++;throw Error('network interrupted');};
    const uncertain=await send(context);
    assert.equal(calls,1);assert.equal(uncertain.failedCount,0);assert.equal(uncertain.uncertain.length,2);
    global.fetch=async()=>({ok:false,status:400,json:async()=>({message:'invalid address'})});
    const rejected=await send(context);assert.equal(rejected.failedCount,2);assert.equal(rejected.uncertain.length,0);
  } finally {
    Object.assign(runtime,original);global.fetch=oldFetch;
    for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);delete require.cache[filename];
  }
});

test('explicit Mailgun recipient limit waits for reset and sends the rejected address once', async () => {
  const source=fs.readFileSync('app.bundle.js','utf8');
  const code=source.slice(source.indexOf('  async function performTryoutEmailSend('),source.indexOf('  async function convertTryoutToMember('));
  let now=Date.now(),calls=0,waited=0;
  const reset=new Date(now+3000).toUTCString();
  const recipient={id:'one',email:'one@example.invalid'};
  const ctx={tryoutEmailSending:false,tryoutEmailResult:null,tryoutEmailRetryMessage:null,tryoutEmailRetryRecipients:[],tryoutStatusRetryIds:[],tryoutSubmissions:[],selectedTryoutSubmissionIds:[],
    Date:{now:()=>now,parse:Date.parse},window:{setTimeout(resolve,ms){now+=ms;waited+=ms;resolve();}},
    document:{getElementById:()=>({textContent:''})},showBlockingProgress(){},hideBlockingProgress(){},showToast(){},mount(){},saveTryoutEmailOutcome(){},
    async sendTryoutEmailsViaFunction(){calls++;return calls===1
      ? {sent:[],uncertain:[],failed:[{...recipient,reason:`recipient limit (26) exceeded, try again after ${reset}`}],sentCount:0,failedCount:1}
      : {sent:[recipient],failed:[],sentCount:1,failedCount:0,statusFailures:[],statusUpdatedIds:[]};}
  };
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await ctx.performTryoutEmailSend([recipient],{subject:'test',bodyTemplate:'test'});
  assert.equal(calls,2);assert.ok(waited>=3000);
  assert.equal(ctx.tryoutEmailResult.sentCount,1);assert.equal(ctx.tryoutEmailResult.failedCount,0);
});

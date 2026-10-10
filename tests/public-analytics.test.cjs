const test=require('node:test');const assert=require('node:assert/strict');const analytics=require('../src/modules/public-analytics.js');
test('public statistics drop query parameters and do not include account or personal fields',()=>{
 const event=analytics.eventFor('/tryout?email=private@example.invalid&secret=private-token#userId=member-123',new Date('2026-10-10T12:00:00Z'));
 assert.equal(event.route,'/tryout');assert.equal(event.message,'Page view /tryout');assert.deepEqual(Object.keys(event).sort(),['level','loggedAt','message','origin','route','scope'].sort());
 assert.doesNotMatch(JSON.stringify(event),/private-token|private@example|member-123/);
});
test('private and individual-person routes cannot become statistics events',()=>{
 for(const path of ['/organization','/fees','/members','/user/private-id','/tryout/private-id','/recovery?secret=private-token','https://evil.invalid/'])assert.equal(analytics.eventFor(path),null);
});
test('statistics count page views only in the requested period and ignore unrelated logs',()=>{
 const now=new Date('2026-10-10T12:00:00Z');
 const summary=analytics.summarize([{scope:'web-analytics',route:'/tryout',logged_at:'2026-10-09T12:00:00Z'},{scope:'web-analytics',route:'/events',logged_at:'2026-09-20T12:00:00Z'},{scope:'web-analytics',route:'/tryout',logged_at:'2026-08-01T12:00:00Z'},{scope:'auth',route:'/tryout',logged_at:'2026-10-09T12:00:00Z'},{scope:'web-analytics',route:'/user/private-id',logged_at:'2026-10-09T12:00:00Z'}],now);
 assert.equal(summary.last7,1);assert.equal(summary.last30,2);assert.deepEqual(summary.pages,[['/tryout',1],['/events',1]]);
});

test('tracking requires consent and skips privacy opt-outs, signed-in users and previews',()=>{
 const base={host:'emperors.page',choice:'allowed',loading:false,signedIn:false,path:'/tryout',doNotTrack:'0',globalPrivacyControl:false,recovery:false};
 assert.equal(analytics.canTrack(base),true);
 for(const override of [{choice:null},{choice:'denied'},{doNotTrack:'1'},{doNotTrack:'yes'},{globalPrivacyControl:true},{loading:true},{signedIn:true},{recovery:true},{path:'/fees'},{host:'localhost'},{host:'preview.emperors.page'}])assert.equal(analytics.canTrack({...base,...override}),false);
});

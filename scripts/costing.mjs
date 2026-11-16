#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
import {page,table as htmlTable,writeOut} from './lib/render.mjs';

const specs={
 help:[0,[]],init:[0,['name']], 'add-period':[0,['code','name','currency','end','retain']],periods:[0,[]],
 'add-object':[0,['code','name','segment','revenue','direct','evidence']],
 'add-pool':[0,['code','name','cost','unit','owner','review','evidence']],
 'set-driver':[2,['quantity','evidence']], 'review-pool':[1,['owner','review','evidence']],
 pools:[0,[]],objects:[0,[]],drivers:[0,[]],allocations:[0,[]],margins:[0,[]],attention:[0,[]],compliance:[0,[]],reconcile:[0,[]],
 insights:[0,['question']],scenario:[1,['cost']],calculate:[0,[]],runs:[0,[]],'sign-off':[1,['reason']],close:[1,['reason']],reopen:[0,['reason']],
 'log-note':[0,['text']],history:[0,[]],import:[2,['kind','map','dry-run']],export:[0,[]],'draft-review':[0,[]]
};
export const operations=Object.keys(specs);
const writes=new Set(['init','add-period','add-object','add-pool','set-driver','review-pool','calculate','sign-off','close','reopen','log-note','import']);
const defaults={pools:{code:'Code',name:'Name',cost:'Cost',unit:'Unit',owner:'Owner',review:'Review Due',evidence:'Evidence'},objects:{code:'Code',name:'Name',segment:'Segment',revenue:'Revenue',direct:'Direct Cost',evidence:'Evidence'},drivers:{pool:'Pool',object:'Object',quantity:'Quantity',evidence:'Evidence'}};
export function money(v){if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw Error('Money must be a nonnegative decimal with at most two places');const [a,b='']=String(v).split('.');const n=BigInt(a)*100n+BigInt(b.padEnd(2,'0'));if(n>9000000000000n)throw Error('Money exceeds limit');return Number(n);}
function quantity(v){if(!/^\d+(\.\d{1,4})?$/.test(String(v))||Number(v)>900000000)throw Error('Quantity needs a nonnegative decimal with at most four places');return String(v);}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Date must be a valid YYYY-MM-DD');return v;}
const required=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}`);return o[k].trim();};
const code=v=>{if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,59}$/.test(v))throw Error('Code must contain letters, numbers, dots, underscores or hyphens');return v.toUpperCase();};
function parse(args){const c=args[0]||'help',spec=specs[c];if(!spec)throw Error(`Unknown command ${c}`);const a=[],o={};for(const v of args.slice(1)){if(!v.startsWith('--')){a.push(v);continue;}const i=v.indexOf('='),k=v.slice(2,i<0?undefined:i),val=i<0?true:v.slice(i+1);if(![...spec[1],'json','period',...(writes.has(c)?['by']:[])].includes(k))throw Error(`Unknown option --${k}`);if(k in o)throw Error(`Duplicate option --${k}`);if(['json','dry-run'].includes(k)){if(val!==true)throw Error(`--${k} takes no value`);}else if(typeof val!=='string'||!val)throw Error(`--${k}=value required`);o[k]=val;}if(a.length!==spec[0])throw Error(`${c} expects ${spec[0]} positional arguments`);return {c,a,o};}
async function resolve(db,t,v,period){const allowed=['periods','pools','objects','runs'];if(!allowed.includes(t))throw Error('Unknown entity');const rows=await db.query(`select * from ${t}${period?' where period_id=$1':''}`,period?[period]:[]);const s=String(v).toLowerCase();let match=rows.filter(r=>String(r.code||r.id).toLowerCase()===s);if(!match.length)match=rows.filter(r=>String(r.name||'').toLowerCase()===s);if(!match.length)match=rows.filter(r=>r.id.startsWith(s)||String(r.name||'').toLowerCase().includes(s));if(match.length!==1)throw Error(`${match.length?'Ambiguous':'No matching'} ${t}: ${match.map(r=>`${r.code||r.id}: ${r.name||''}`).join('; ')}`);return match[0];}
const audit=(db,p,c,by,detail)=>db.query('insert into history(period_id,action,operator,detail) values($1,$2,$3,$4)',[p,c,by,JSON.stringify(detail)]);
const bump=(db,p)=>db.query('update periods set revision=revision+1 where id=$1',[p]);
const checkOpen=p=>{if(p.status!=='open')throw Error('Period is closed; reopen with a reason first');};
async function pools(db,p){return db.query('select code,name,cost_cents,unit,owner,review_due,evidence,quantity,allocated_cents,unallocated_cents,overdue from v_pool_review where period_id=$1 order by code',[p]);}
async function margins(db,p){return db.query('select code,name,segment,revenue_cents,direct_cents,overhead_cents,contribution_cents from v_margins where period_id=$1 order by contribution_cents,code',[p]);}
async function allocations(db,p){return db.query('select pool,object,name,quantity,allocated_cents from v_allocations where period_id=$1 order by pool,object',[p]);}
async function reconciliation(db,p){return db.query('select coalesce(sum(cost_cents),0)::bigint input_cents,coalesce(sum(allocated_cents),0)::bigint allocated_cents,coalesce(sum(unallocated_cents),0)::bigint unallocated_cents from v_pool_review where period_id=$1',[p]);}
const source='https://www.ird.govt.nz/records';
async function compliance(db,p){const out=[];const add=(rule,record,issue,url=source)=>out.push({rule,record,issue,source:url});
 for(const x of await pools(db,p.id)){
 if(!x.owner.trim())add('OWNER',x.code,'Assign a cost pool owner','docs/compliance.md#model-controls');
 if(!x.evidence.trim())add('EVIDENCE',x.code,'Retain the source cost evidence');
 if(x.overdue)add('REVIEW',x.code,'Driver basis review is overdue','docs/compliance.md#model-controls');
 if(Number(x.unallocated_cents)!==0)add('UNALLOCATED',x.code,'Positive overhead has no positive consumption','docs/compliance.md#model-controls');
 }
 for(const x of await db.query("select code from objects where period_id=$1 and trim(evidence)=''",[p.id]))add('EVIDENCE',x.code,'Retain revenue and direct cost evidence');
 for(const x of await db.query("select p.code pool,o.code object from drivers d join pools p on p.id=d.pool_id join objects o on o.id=d.object_id where d.period_id=$1 and trim(d.evidence)=''",[p.id]))add('DRIVER-EVIDENCE',`${x.pool}/${x.object}`,'Retain measured consumption evidence');
 const retention=(await db.query("select retention_until >= (end_date + interval '7 years')::date as adequate from periods where id=$1",[p.id]))[0];
 if(!retention.adequate)add('RETENTION',p.code,'Retention review date is earlier than the workspace seven-year minimum');
 const counts=(await db.query('select (select count(*) from pools where period_id=$1)::integer pools,(select count(*) from objects where period_id=$1)::integer objects',[p.id]))[0];
 if(!counts.pools||!counts.objects)add('EMPTY',p.code,'Add cost pools and cost objects before sign-off','docs/compliance.md#model-controls');
 return out;
}
export const questions=[
 ['Which customers lose money after their activity share?',"select code,name,contribution_cents from v_margins where period_id=$1 and contribution_cents<0 order by contribution_cents"],
 ['Which pools still have cost nobody consumes?',"select code,unallocated_cents from v_pool_review where period_id=$1 and unallocated_cents>0 order by code"],
 ['Which allocation bases are overdue for review?',"select code,owner,review_due from v_pool_review where period_id=$1 and overdue order by review_due"],
 ['Which cost pools have no accountable owner?',"select code,name from pools where period_id=$1 and trim(owner)='' order by code"],
 ['Which customers receive no overhead allocation?',"select code,name from v_margins where period_id=$1 and overhead_cents=0 order by code"],
 ['Which customers consume more than half of a cost pool?',"select pool,object,quantity from v_allocations a where period_id=$1 and quantity>0.5*(select sum(d.quantity) from drivers d where d.pool_id=a.pool_id) order by pool,object"],
 ['Which customer segments carry the weakest contribution?',"select segment,sum(revenue_cents)::bigint revenue_cents,sum(contribution_cents)::bigint contribution_cents from v_margins where period_id=$1 group by segment order by contribution_cents"],
 ['Which consumption measurements have no supporting evidence?',"select p.code pool,o.code object from drivers d join pools p on p.id=d.pool_id join objects o on o.id=d.object_id where d.period_id=$1 and trim(d.evidence)='' order by pool,object"],
 ['Which signed calculations have been overtaken by new inputs?',"select r.id,r.revision,p.revision current_revision,s.operator from runs r join periods p on p.id=r.period_id join signatures s on s.run_id=r.id where r.period_id=$1 and r.revision<>p.revision order by r.created_at"],
 ['Which owners hold the most unallocated cost?',"select owner,sum(unallocated_cents)::bigint unallocated_cents from v_pool_review where period_id=$1 group by owner having sum(unallocated_cents)>0 order by unallocated_cents desc"]
];
async function upsert(db,p,kind,o){
 if(kind==='objects'){
 const v=[p,code(required(o,'code')),required(o,'name'),required(o,'segment'),money(required(o,'revenue')),money(required(o,'direct')),required(o,'evidence')];
 return (await db.query('insert into objects(period_id,code,name,segment,revenue_cents,direct_cents,evidence) values($1,$2,$3,$4,$5,$6,$7) on conflict(period_id,code) do update set name=excluded.name,segment=excluded.segment,revenue_cents=excluded.revenue_cents,direct_cents=excluded.direct_cents,evidence=excluded.evidence returning code',v))[0];
 }
 if(kind==='pools'){
 const v=[p,code(required(o,'code')),required(o,'name'),money(required(o,'cost')),required(o,'unit'),required(o,'owner'),date(required(o,'review')),required(o,'evidence')];
 return (await db.query('insert into pools(period_id,code,name,cost_cents,unit,owner,review_due,evidence) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(period_id,code) do update set name=excluded.name,cost_cents=excluded.cost_cents,unit=excluded.unit,owner=excluded.owner,review_due=excluded.review_due,evidence=excluded.evidence returning code',v))[0];
 }
 const pool=await resolve(db,'pools',required(o,'pool'),p),obj=await resolve(db,'objects',required(o,'object'),p);
 return (await db.query('insert into drivers(period_id,pool_id,object_id,quantity,evidence) values($1,$2,$3,$4,$5) on conflict(pool_id,object_id) do update set quantity=excluded.quantity,evidence=excluded.evidence returning quantity',[p,pool.id,obj.id,quantity(required(o,'quantity')),required(o,'evidence')]))[0];
}
async function snapshot(db,p){return {period:p,pools:await db.query('select * from pools where period_id=$1 order by code',[p.id]),objects:await db.query('select * from objects where period_id=$1 order by code',[p.id]),drivers:await db.query('select * from drivers where period_id=$1 order by pool_id,object_id',[p.id]),allocations:await allocations(db,p.id),margins:await margins(db,p.id),reconciliation:await reconciliation(db,p.id),findings:await compliance(db,p)};}
export async function run(db,args){const {c,a,o}=parse(args);if(c==='help')return {commands:operations,usage:'node scripts/costing.mjs <command> [arguments] --period=CODE [--by=Name] [--json]',reference:'docs/cli.md'};
 const write=writes.has(c),by=write?required(o,'by'):null;
 await db.exec(write?'BEGIN':'BEGIN READ ONLY');
 try {
 if(write)await db.exec('LOCK TABLE workspace IN EXCLUSIVE MODE');
 const ws=(await db.query('select * from workspace where id=1'))[0];
 if(c!=='init'&&!ws)throw Error('Run init --name=Business --by=Operator first');
 let result;
 if(c==='init'){if(ws)throw Error('Workspace already initialized');await db.query('insert into workspace(id,name) values(1,$1)',[required(o,'name')]);await audit(db,null,c,by,{name:o.name});result={initialized:o.name};}
 else if(c==='add-period'){
 const currency=required(o,'currency').toUpperCase();if(!['NZD','AUD','USD','GBP','EUR'].includes(currency))throw Error('Unsupported currency');const end=date(required(o,'end')),retain=date(required(o,'retain'));if(retain<end)throw Error('Retention date precedes period end');
 result=(await db.query('insert into periods(code,name,currency,end_date,retention_until) values($1,$2,$3,$4,$5) returning *',[code(required(o,'code')),required(o,'name'),currency,end,retain]))[0];await audit(db,result.id,c,by,result);
 }else if(c==='periods')result=await db.query('select code,name,currency,end_date,retention_until,status,revision from periods order by end_date,code');
 else {
 const p=await resolve(db,'periods',required(o,'period'));
 if(write&&!['reopen','log-note'].includes(c))checkOpen(p);
 const pid=p.id;
 switch(c){
 case 'add-object':case 'add-pool':{
 const kind=c==='add-pool'?'pools':'objects';if((await db.query(`select id from ${kind} where period_id=$1 and code=$2`,[pid,code(required(o,'code'))])).length)throw Error('Code already exists; use a reviewed import to update it');
 result=await upsert(db,pid,kind,o);await bump(db,pid);break;
 }
 case 'set-driver':result=await upsert(db,pid,'drivers',{...o,pool:a[0],object:a[1]});await bump(db,pid);break;
 case 'review-pool':{const pool=await resolve(db,'pools',a[0],pid);result=(await db.query('update pools set owner=$1,review_due=$2,evidence=$3 where id=$4 returning code,owner,review_due',[required(o,'owner'),date(required(o,'review')),required(o,'evidence'),pool.id]))[0];await bump(db,pid);break;}
 case 'pools':result=await pools(db,pid);break;
 case 'objects':result=await db.query('select code,name,segment,revenue_cents,direct_cents,evidence from objects where period_id=$1 order by code',[pid]);break;
 case 'drivers':result=await db.query('select p.code pool,o.code object,d.quantity,d.evidence from drivers d join pools p on p.id=d.pool_id join objects o on o.id=d.object_id where d.period_id=$1 order by pool,object',[pid]);break;
 case 'allocations':result=await allocations(db,pid);break;
 case 'margins':result=await margins(db,pid);break;
 case 'attention':case 'compliance':result=await compliance(db,p);break;
 case 'reconcile':result=await reconciliation(db,pid);break;
 case 'insights':{
 const q=o.question?Number(o.question):null;if(o.question&&(!Number.isInteger(q)||q<1||q>10))throw Error('Question must be 1 to 10');result=[];for(let i=0;i<questions.length;i++)if(q===null||q===i+1)result.push({number:i+1,question:questions[i][0],rows:await db.query(questions[i][1],[pid])});break;
 }
 case 'scenario':{
 const pool=await resolve(db,'pools',a[0],pid),cost=money(required(o,'cost'));
 // Calculate with integer weights and exact cents without changing the model.
 const ds=await db.query('select o.code object,d.quantity from drivers d join objects o on o.id=d.object_id where d.pool_id=$1 order by o.code',[pool.id]);
 const weights=ds.map(d=>BigInt(String(d.quantity).replace('.','').padEnd(String(d.quantity).split('.')[0].length+4,'0'))),total=weights.reduce((a,b)=>a+b,0n);
 const rows=ds.map((d,i)=>({object:d.object,allocated_cents:total?Number(BigInt(cost)*weights[i]/total):0,remainder:total?BigInt(cost)*weights[i]%total:0n}));
 let left=total?cost-rows.reduce((n,x)=>n+x.allocated_cents,0):0;for(const row of [...rows].sort((a,b)=>a.remainder===b.remainder?a.object.localeCompare(b.object):a.remainder>b.remainder?-1:1)){if(left-->0)row.allocated_cents++;}
 result={pool:pool.code,currency:p.currency,cost_cents:cost,unallocated_cents:total?0:cost,allocations:rows.map(({remainder,...x})=>x),persisted:false};break;
 }
 case 'calculate':result=(await db.query('insert into runs(period_id,revision,snapshot,operator) values($1,$2,$3,$4) returning id,revision',[pid,p.revision,JSON.stringify(await snapshot(db,p)),by]))[0];break;
 case 'runs':result=await db.query('select r.id,r.revision,r.operator,r.created_at,s.operator signed_by,(r.revision<>$2) stale from runs r left join signatures s on s.run_id=r.id where r.period_id=$1 order by r.created_at,r.id',[pid,p.revision]);break;
 case 'sign-off':case 'close':{
 const r=await resolve(db,'runs',a[0],pid);if(r.revision!==p.revision)throw Error('Stale calculation; calculate again');const issues=await compliance(db,p);if(issues.length)throw Error(`Resolve findings before sign-off or close: ${issues.map(i=>i.rule+':'+i.record).join(', ')}`);const reason=required(o,'reason');
 if(c==='sign-off')result=(await db.query('insert into signatures(run_id,operator,reason) values($1,$2,$3) returning id,run_id',[r.id,by,reason]))[0];
 else {if(!(await db.query('select id from signatures where run_id=$1',[r.id])).length)throw Error('Sign off this calculation before closing');await db.query("update periods set status='closed' where id=$1",[pid]);result={closed:p.code,run:r.id};}break;
 }
 case 'reopen':if(p.status!=='closed')throw Error('Period is already open');required(o,'reason');await db.query("update periods set status='open',revision=revision+1 where id=$1",[pid]);result={reopened:p.code};break;
 case 'log-note':result={note:required(o,'text')};break;
 case 'history':result=await db.query('select action,operator,detail,created_at from history where period_id=$1 order by created_at,id',[pid]);break;
 case 'import':{
 if(a[0]!=='costperform')throw Error('Importer supports costperform');const kind=required(o,'kind');if(!defaults[kind])throw Error('Import kind must be pools, objects or drivers');
 const raw=fs.readFileSync(path.resolve(a[1]),'utf8'),mapping=o.map?JSON.parse(fs.readFileSync(path.resolve(o.map),'utf8')):defaults[kind];
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object'||Object.keys(mapping).sort().join(',')!==Object.keys(defaults[kind]).sort().join(','))throw Error('Mapping must name exactly the fields for this import kind');
 if(Object.values(mapping).some(v=>typeof v!=='string'||!v)||new Set(Object.values(mapping)).size!==Object.keys(mapping).length)throw Error('Mapping columns must be unique strings');
 const digest=createHash('sha256').update(JSON.stringify({raw,mapping})).digest('hex');
 const prior=await db.query('select id from imports where period_id=$1 and kind=$2 and digest=$3',[pid,kind,digest]);
 if(prior.length){result={duplicate:true,rows:0,note:'This exact file and mapping were imported before; current records were left unchanged'};break;}
 const rows=parseCsv(raw);if(!rows.length)throw Error('CSV contains no records');const keys=new Set();
 for(const row of rows){const v={};for(const [key,column] of Object.entries(mapping)){if(!(column in row))throw Error(`Missing CSV column ${column}`);v[key]=row[column];}const key=kind==='drivers'?`${v.pool.toUpperCase()}/${v.object.toUpperCase()}`:code(v.code);if(keys.has(key))throw Error(`Duplicate input key ${key}`);keys.add(key);await upsert(db,pid,kind,v);}
 await bump(db,pid);await db.query('insert into imports(period_id,kind,digest,row_count,mapping,operator) values($1,$2,$3,$4,$5,$6)',[pid,kind,digest,rows.length,JSON.stringify(mapping),by]);result={kind,rows:rows.length,dry_run:Boolean(o['dry-run'])};break;
 }
 case 'export':{
 const out={format:'activity-costing-v1',exported_at:new Date().toISOString(),workspace:ws,model:await snapshot(db,p)};
 for(const t of ['runs','history','imports'])out[t]=await db.query(`select * from ${t} where period_id=$1 order by created_at,id`,[pid]);out.signatures=await db.query('select s.* from signatures s join runs r on r.id=s.run_id where r.period_id=$1',[pid]);
 const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'exports');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,`${p.code}-${randomUUID()}.json`);fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{mode:0o600});result={file};break;
 }
 case 'draft-review':result={file:writeOut('drafts',`${p.code}-${randomUUID()}`,page({title:'Cost allocation review',subtitle:`${p.name} | ${p.currency} | revision ${p.revision} | Draft`,sections:[{title:'Findings',html:htmlTable(await compliance(db,p))},{title:'Customer contribution',html:htmlTable(await margins(db,pid))},{title:'Reconciliation',html:htmlTable(await reconciliation(db,pid))}]}))};break;
 }
 if(write)await audit(db,pid,c,by,{arguments:a,options:Object.fromEntries(Object.entries(o).filter(([k])=>!['json','by'].includes(k))),result});
 }
 await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function present(result){if(Array.isArray(result)){if(!result.length)return '(none)';if(result[0].question)return result.map(x=>`${x.number}. ${x.question}\n${present(x.rows)}`).join('\n\n');return table(result,Object.keys(result[0]).map(k=>({key:k,label:k.replace(/_cents$/, '').replace(/_/g,' '),width:/source|evidence|detail/.test(k)?52:undefined,format:v=>k.endsWith('_cents')?(Number(v)/100).toFixed(2):v&&typeof v==='object'?JSON.stringify(v):v})));}return JSON.stringify(result,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):present(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,present} from './costing.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'activity-costing-demo-'));
process.env.DATABASE_URL='';process.env.DATA_DIR=path.join(dir,'db');process.env.OUTPUT_DIR=dir;
let db;const captures=[];
try{db=await getDb();await migrate(db);await seed(db);
for(const [title,ask,command] of [
 ['Customer contribution, NZD','Which customers cost more to serve than they bring in?','margins'],
 ['Allocation gaps, NZD','How much overhead still has no activity to allocate it by?','reconcile'],
 ['Overdue reviews','Which allocation bases need their owner to review them?','insights --question=3']
]){const args=command.split(' ');args.push('--period=DEMO');const output=present(await run(db,args));captures.push({title,ask,command:`node scripts/costing.mjs ${args.join(' ')}`,output});console.log(`\n${title}\n${output}`);}
fs.writeFileSync(path.join(dir,'captures.json'),JSON.stringify(captures,null,2)+'\n');
await db.close();db=null;
for(const script of ['docs.mjs','view.mjs']){const res=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script)],{env:process.env,encoding:'utf8'});if(res.status!==0)throw Error(res.stderr);console.log(res.stdout.trim());}
console.log(`Demo PASS: fictional records, 3 captures, 3 views, 4 documents. Files: ${dir}`);
}finally{await db?.close();if(!process.argv.includes('--keep'))fs.rmSync(dir,{recursive:true,force:true});}

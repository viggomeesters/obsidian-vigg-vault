// Required bundler interface: embed reviewed Worker and WASM, never fetch them at runtime.
import {build} from 'esbuild';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const wasm = readFileSync('vendor/wasm/link_style_core.wasm');
const worker = readFileSync('vendor/validator-worker.mjs','utf8');
const noticeFiles=readdirSync('docs/licenses',{recursive:true,withFileTypes:true}).filter(f=>f.isFile()&&!f.name.endsWith('.json')).map(f=>join(f.parentPath,f.name)).sort();
const notices=['LICENSE','THIRD-PARTY-NOTICES.md',...noticeFiles].map(path=>`${path}\n${readFileSync(path,'utf8')}`).join('\n\n');
await build({entryPoints:['src/main.ts'],bundle:true,format:'cjs',target:'es2022',external:['obsidian'],outfile:'main.js',banner:{js:`/*!\n${notices.replaceAll('*/','* /')}\n*/`},define:{WASM_BASE64:JSON.stringify(wasm.toString('base64')),WORKER_SOURCE:JSON.stringify(worker),'import.meta.url':JSON.stringify('blob:vigg-vault-worker-factory-required')},logLevel:'info'});

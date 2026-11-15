// Headless UI evidence only: exercises the built plugin mock, never an Obsidian window.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','--test-name-pattern','overview is read-only','tests/plugin.test.mjs'],{encoding:'utf8'});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if(result.status!==0)process.exit(result.status??1);
console.log('Headless evidence: built-plugin overview rendered through mocks; no real Obsidian window was opened.');

declare module '*.mjs' {
  import type {Vault} from 'obsidian';
  export function validateVaultSnapshot(vault:Vault, wasm:Uint8Array, options:{targets:string[]|null;signal:AbortSignal;createWorker:()=>Worker}):Promise<unknown>;
}
declare const WASM_BASE64:string;
declare const WORKER_SOURCE:string;

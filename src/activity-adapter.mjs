// Required Obsidian/Worker boundary. YAML/body capture uses injected Obsidian APIs;
// all Activity text rules remain in the separately pinned Rust engine.
const SCHEMA = 'viggobsidian.activity-result.v1';
export const incompleteActivity = reason => ({schema:SCHEMA,status:'incomplete',reason});
export function activityOutcome(value, path) {
  if (!value || typeof value !== 'object' || value.schema !== SCHEMA) return incompleteActivity('invalid_engine_response');
  if (value.status === 'incomplete' && typeof value.reason === 'string' && value.reason.length > 0) return value;
  if (value.status === 'not_applicable' && ['profile_not_selected','activity_contract_not_selected'].includes(value.reason)) return value;
  const r = value.report;
  if (value.status !== 'complete' || !Array.isArray(value.capabilities) || !['activity-text.v1','provenance-v1','chat-v1','event-activity-v1.1','mail-delivery-v1'].every(c=>value.capabilities.includes(c)) || !r || r.path !== path || !Array.isArray(r.findings) || r.findings.length > 100 || !r.findings.every(f => f && f.path === path && typeof f.code === 'string' && f.code.length > 0 && f.code.length <= 100 && typeof f.message === 'string' && f.message.length > 0 && f.message.length <= 4096 && !('line' in f) && !('severity' in f))) return incompleteActivity('invalid_engine_report');
  return value;
}
export async function validateActivityNote(vault, file, wasmBytes, {
  profile, getFrontMatterInfo, parseYaml, signal, timeoutMs = 10_000, createWorker,
}) {
  let changed = false, settled = false, worker, timer, abort;
  const signature = () => JSON.stringify([file.path,file.stat.mtime,file.stat.ctime,file.stat.size]);
  const captured = signature();
  const path = file.path;
  const events = ['modify','create','delete','rename'].map(name => vault.on(name, () => {changed = true;}));
  try {
    const result = await Promise.race([
      (async () => {
        if (settled || signal?.aborted) return incompleteActivity('cancelled');
        if (file.stat.size > 1024 * 1024) return incompleteActivity('content_limit');
        const markdown = await vault.read(file);
        if (new TextEncoder().encode(markdown).length > 1024 * 1024) return incompleteActivity('content_limit');
        if (settled || signal?.aborted) return incompleteActivity('cancelled');
        if (changed || signature() !== captured) return incompleteActivity('snapshot_changed');
        const info = getFrontMatterInfo(markdown);
        if (!info || typeof info.exists !== 'boolean' || !Number.isInteger(info.contentStart) || info.contentStart < 0 || info.contentStart > markdown.length) return incompleteActivity('invalid_metadata_boundary');
        // Obsidian's frontmatter API does not accept an unterminated opening block.
        // Detect it through the same API by appending a closing delimiter, not a YAML parser.
        if (!info.exists && getFrontMatterInfo(markdown + '\n---\n').exists) return incompleteActivity('invalid_frontmatter');
        let metadata = {};
        if (info.exists) {
          if (typeof info.frontmatter !== 'string') return incompleteActivity('invalid_metadata_boundary');
          metadata = parseYaml(info.frontmatter);
          if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return incompleteActivity('invalid_frontmatter');
        }
        // Forward only rule metadata. Never copy local providers or identity configuration.
        const ruleMetadata = Object.fromEntries(['cssclasses','activity_contract','activity_format'].filter(key=>Object.hasOwn(metadata,key)).map(key=>[key,metadata[key]]));
        const snapshot = {schema:'viggobsidian.activity-snapshot.v1',ruleset:'activity-text.v1',complete:true,frontmatter_present:info.exists,profile,metadata:ruleMetadata,path,body:markdown.slice(info.contentStart)};
        if (settled || signal?.aborted) return incompleteActivity('cancelled');
        if (changed || signature() !== captured) return incompleteActivity('snapshot_changed');
        worker = createWorker();
        return await new Promise(resolve => {
          worker.onmessage = ({data}) => resolve(activityOutcome(data,path));
          worker.onerror = () => resolve(incompleteActivity('worker_failed'));
          worker.postMessage({wasmBytes,snapshot});
        });
      })(),
      new Promise(resolve => {
        timer = setTimeout(() => resolve(incompleteActivity('timeout')), timeoutMs);
        abort = () => resolve(incompleteActivity('cancelled'));
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted) abort();
      }),
    ]);
    if (settled || signal?.aborted) return incompleteActivity('cancelled');
    if (changed || signature() !== captured) return incompleteActivity('snapshot_changed');
    return result;
  } catch {return incompleteActivity('capture_or_worker_failed');}
  finally {settled = true;clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);worker?.terminate();events.forEach(e=>vault.offref(e));}
}

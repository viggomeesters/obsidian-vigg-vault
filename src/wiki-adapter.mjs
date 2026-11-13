// Required Obsidian/Worker boundary. YAML/body capture uses injected Obsidian APIs;
// all Wiki text rules remain in the separately pinned Rust engine.
const SCHEMA = 'viggobsidian.wiki-layout-result.v1';
export const incompleteWiki = reason => ({schema:SCHEMA,status:'incomplete',reason});
export function wikiOutcome(value, path) {
  if (!value || typeof value !== 'object' || value.schema !== SCHEMA) return incompleteWiki('invalid_engine_response');
  if (value.status === 'incomplete' && typeof value.reason === 'string' && value.reason.length > 0) return value;
  if (value.status === 'not_applicable' && value.reason === 'profile_or_classification_not_selected') return value;
  const r = value.report;
  if (value.status !== 'complete' || !r || r.path !== path || typeof r.has_facts !== 'boolean' || !Array.isArray(r.findings) || r.findings.length > 100 || !r.findings.every(f => f && f.path === path && typeof f.code === 'string' && f.code.length > 0 && f.code.length <= 100 && typeof f.message === 'string' && f.message.length > 0 && f.message.length <= 4096 && !('line' in f) && !('severity' in f))) return incompleteWiki('invalid_engine_report');
  return value;
}
export async function validateWikiNote(vault, file, wasmBytes, {
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
        if (settled || signal?.aborted) return incompleteWiki('cancelled');
        if (file.stat.size > 1024 * 1024) return incompleteWiki('content_limit');
        const markdown = await vault.read(file);
        if (new TextEncoder().encode(markdown).length > 1024 * 1024) return incompleteWiki('content_limit');
        if (settled || signal?.aborted) return incompleteWiki('cancelled');
        if (changed || signature() !== captured) return incompleteWiki('snapshot_changed');
        const info = getFrontMatterInfo(markdown);
        if (!info || typeof info.exists !== 'boolean' || !Number.isInteger(info.contentStart) || info.contentStart < 0 || info.contentStart > markdown.length) return incompleteWiki('invalid_metadata_boundary');
        // Obsidian's frontmatter API does not accept an unterminated opening block.
        // Detect it through the same API by appending a closing delimiter, not a YAML parser.
        if (!info.exists && getFrontMatterInfo(markdown + '\n---\n').exists) return incompleteWiki('invalid_frontmatter');
        let metadata = {};
        if (info.exists) {
          if (typeof info.frontmatter !== 'string') return incompleteWiki('invalid_metadata_boundary');
          metadata = parseYaml(info.frontmatter);
          if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return incompleteWiki('invalid_frontmatter');
        }
        if ('cssclasses' in metadata && (!Array.isArray(metadata.cssclasses) || !metadata.cssclasses.every(c=>typeof c === 'string'))) return incompleteWiki('invalid_cssclasses');
        const snapshot = {schema:'viggobsidian.wiki-layout-snapshot.v2',ruleset:'wiki-layout.v1',complete:true,profile,cssclasses:metadata.cssclasses ?? [],path,body:markdown.slice(info.contentStart)};
        if (settled || signal?.aborted) return incompleteWiki('cancelled');
        if (changed || signature() !== captured) return incompleteWiki('snapshot_changed');
        worker = createWorker();
        return await new Promise(resolve => {
          worker.onmessage = ({data}) => resolve(wikiOutcome(data,path));
          worker.onerror = () => resolve(incompleteWiki('worker_failed'));
          worker.postMessage({wasmBytes,snapshot});
        });
      })(),
      new Promise(resolve => {
        timer = setTimeout(() => resolve(incompleteWiki('timeout')), timeoutMs);
        abort = () => resolve(incompleteWiki('cancelled'));
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted) abort();
      }),
    ]);
    if (settled || signal?.aborted) return incompleteWiki('cancelled');
    if (changed || signature() !== captured) return incompleteWiki('snapshot_changed');
    return result;
  } catch {return incompleteWiki('capture_or_worker_failed');}
  finally {settled = true;clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);worker?.terminate();events.forEach(e=>vault.offref(e));}
}

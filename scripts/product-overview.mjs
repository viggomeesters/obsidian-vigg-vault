// Build-time product metadata. It reads reviewed declarations and fails closed.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';

const CATALOG_SCHEMA = 'viggobsidian.product-capabilities.v1';
const CATALOG_PROVENANCE_SCHEMA = 'viggobsidian.product-capabilities-provenance.v1';
const CATALOG_REPOSITORY = 'https://github.com/viggomeesters/viggobsidian';
const CATALOG_SOURCE_PATH = 'schemas/product-capabilities.v1.json';
// Exact independently reviewed upstream export. Updating a local catalog and
// its provenance together is not authority to change the accepted contract.
const CATALOG_PIN = Object.freeze({
  revision:'380d95328837cf33298fdcb61d27f8f0e938726b',
  sha256:'9e6862f7bfdd9afe35e9b1205cfdb1fe5dda6d63a904153201a907f258e9288a',
});
const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;

const ENGINE_CONTRACTS = [
  {
    id:'link-style-text',
    label:'Work link style',
    protocols:['viggobsidian.link-style-snapshot.v1','viggobsidian.link-style-result.v1'],
    requestSchema:'viggobsidian.link-style-snapshot.v1',
    resultSchema:'viggobsidian.link-style-result.v1',
    rulesets:[],
    provenancePath:'vendor/provenance.json',
    wasmPath:'vendor/wasm/link_style_core.wasm',
    wasmProvenancePath:'vendor/wasm/provenance.json',
  },
  {
    id:'wiki-layout-text',
    label:'Wiki layout',
    protocols:['viggobsidian.wiki-layout-snapshot.v1','viggobsidian.wiki-layout-snapshot.v2','viggobsidian.wiki-layout-result.v1'],
    requestSchema:'viggobsidian.wiki-layout-snapshot.v2',
    resultSchema:'viggobsidian.wiki-layout-result.v1',
    rulesets:['wiki-layout.v1'],
    provenancePath:'vendor/wiki-provenance.json',
    wasmPath:'vendor/wasm/wiki_layout_core.wasm',
    wasmProvenancePath:'vendor/wasm/wiki-provenance.json',
  },
  {
    id:'activity-text',
    label:'Activity text',
    protocols:['viggobsidian.activity-snapshot.v1','viggobsidian.activity-result.v1'],
    requestSchema:'viggobsidian.activity-snapshot.v1',
    resultSchema:'viggobsidian.activity-result.v1',
    rulesets:['activity-text.v1'],
    provenancePath:'vendor/activity-provenance.json',
    wasmPath:'vendor/wasm/activity_core.wasm',
    wasmProvenancePath:'vendor/wasm/activity-provenance.json',
  },
];

const KNOWN_CAPABILITIES = new Map([
  ['link-style-text',{status:'shipped',surface:'portable-text'}],
  ['wiki-layout-text',{status:'shipped',surface:'portable-text'}],
  ['activity-text',{status:'shipped',surface:'portable-text'}],
  ['source-preparation-native',{status:'shipped',surface:'native-only'}],
  ['vault-layout-native',{status:'shipped',surface:'native-only'}],
  ['package-lifecycle-native',{status:'shipped',surface:'native-only'}],
  ['visible-folder-entrance-proof',{status:'unshipped-proof',surface:'portable-text-proof'}],
]);

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const requiredString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`);
  return value;
};
const exactStrings = (actual, expected, label) => {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`Unexpected ${label}`);
};
const relativePath = (root, path, label) => {
  const resolved = resolve(root, path);
  if (relative(root, resolved).startsWith('..')) throw new Error(`Unsafe ${label}`);
  return resolved;
};
const sha256 = (value, label) => {
  if (!SHA256.test(requiredString(value, label))) throw new Error(`Invalid ${label}`);
  return value;
};

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Invalid product capabilities catalog');
  if (catalog.schema !== CATALOG_SCHEMA || catalog.catalog_version !== 1 || !Array.isArray(catalog.capabilities)) throw new Error('Unsupported product capabilities catalog');
  if (catalog.capabilities.length !== KNOWN_CAPABILITIES.size) throw new Error('Unexpected product capability count');

  const byId = new Map();
  for (const capability of catalog.capabilities) {
    if (!capability || typeof capability !== 'object' || Array.isArray(capability)) throw new Error('Invalid product capability');
    const id = requiredString(capability.id, 'capability id');
    const known = KNOWN_CAPABILITIES.get(id);
    if (!known || byId.has(id)) throw new Error(`Unknown or duplicate capability: ${id}`);
    if (capability.status !== known.status || capability.surface !== known.surface) throw new Error(`Unexpected capability surface: ${id}`);
    if (!Array.isArray(capability.protocols) || !capability.protocols.every(value => typeof value === 'string')) throw new Error(`Invalid capability protocols: ${id}`);
    if (!Array.isArray(capability.rulesets) || !capability.rulesets.every(value => typeof value === 'string')) throw new Error(`Invalid capability rulesets: ${id}`);
    if (!Array.isArray(capability.commands) || !capability.commands.every(value => typeof value === 'string')) throw new Error(`Invalid capability commands: ${id}`);
    requiredString(capability.scope, `capability scope: ${id}`);
    byId.set(id, capability);
  }

  for (const contract of ENGINE_CONTRACTS) {
    const capability = byId.get(contract.id);
    if (!capability) throw new Error(`Missing required capability: ${contract.id}`);
    exactStrings(capability.protocols, contract.protocols, `${contract.id} protocols`);
    exactStrings(capability.rulesets, contract.rulesets, `${contract.id} rulesets`);
  }
  return byId;
}

function validateSourceHashes(root, hashes, label) {
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes) || Object.keys(hashes).length === 0) throw new Error(`Missing ${label} source hashes`);
  for (const [path, expected] of Object.entries(hashes)) {
    if (digest(relativePath(root, path, `${label} source path`)) !== sha256(expected, `${label} source hash`)) throw new Error(`${label} source hash mismatch: ${path}`);
  }
}

function engine(root, contract, capability) {
  const provenance = json(relativePath(root, contract.provenancePath, `${contract.id} provenance`));
  const wasmProvenance = json(relativePath(root, contract.wasmProvenancePath, `${contract.id} WASM provenance`));
  const wasmSha256 = digest(relativePath(root, contract.wasmPath, `${contract.id} WASM`));
  if (!provenance || typeof provenance !== 'object') throw new Error(`Invalid ${contract.id} provenance`);
  if (!REVISION.test(requiredString(provenance.revision, `${contract.id} revision`))) throw new Error(`Invalid ${contract.id} revision`);
  validateSourceHashes(root, provenance.unchangedFiles, `${contract.id} provenance`);
  if (!wasmProvenance || typeof wasmProvenance !== 'object') throw new Error(`Invalid ${contract.id} WASM provenance`);
  if (wasmProvenance.asset !== contract.wasmPath) throw new Error(`${contract.id} WASM asset mismatch`);
  if (wasmProvenance.sourceProvenance !== contract.provenancePath) throw new Error(`${contract.id} provenance link mismatch`);
  if (wasmSha256 !== sha256(wasmProvenance.sha256, `${contract.id} WASM digest`)) throw new Error(`${contract.id} WASM digest mismatch`);
  validateSourceHashes(root, wasmProvenance.sourceFiles, `${contract.id} WASM provenance`);
  return {
    id:contract.id,
    label:contract.label,
    revision:provenance.revision,
    requestSchema:contract.requestSchema,
    resultSchema:contract.resultSchema,
    rulesets:[...contract.rulesets],
    capabilities:[...capability.protocols],
    wasmSha256,
  };
}

export function productOverview({root, catalogPath, provenancePath} = {}) {
  const resolvedRoot = resolve(root ?? (catalogPath ? dirname(catalogPath) : process.cwd()));
  const resolvedCatalogPath = resolve(catalogPath ?? relativePath(resolvedRoot, 'vendor/product-capabilities.v1.json', 'product capabilities catalog'));
  const resolvedProvenancePath = resolve(provenancePath ?? relativePath(resolvedRoot, 'vendor/product-capabilities-provenance.json', 'product capabilities provenance'));
  const catalog = json(resolvedCatalogPath);
  const provenance = json(resolvedProvenancePath);
  const capabilities = validateCatalog(catalog);
  if (!provenance || typeof provenance !== 'object' || provenance.schema !== CATALOG_PROVENANCE_SCHEMA) throw new Error('Unsupported product capabilities provenance');
  if (Object.keys(provenance).sort().join(',') !== 'catalog,repository,revision,schema,sha256,sourcePath') throw new Error('Unexpected product capabilities provenance fields');
  if (provenance.repository !== CATALOG_REPOSITORY || provenance.sourcePath !== CATALOG_SOURCE_PATH) throw new Error('Product capabilities provenance source mismatch');
  if (provenance.catalog !== relative(resolvedRoot, resolvedCatalogPath)) throw new Error('Product capabilities provenance catalog mismatch');
  if (!REVISION.test(requiredString(provenance.revision, 'product capabilities revision'))) throw new Error('Invalid product capabilities revision');
  if (provenance.revision !== CATALOG_PIN.revision || provenance.sha256 !== CATALOG_PIN.sha256) throw new Error('Product capabilities reviewed pin mismatch');
  // This anchors every byte/field/ordered array to the reviewed Rust export,
  // rather than trusting a mutable catalog/provenance pair to attest itself.
  if (digest(resolvedCatalogPath) !== CATALOG_PIN.sha256) throw new Error('Product capabilities digest mismatch');

  const manifest = json(relativePath(resolvedRoot, 'manifest.json', 'manifest'));
  const product = {};
  for (const key of ['id','name','version','minAppVersion']) product[key] = requiredString(manifest[key], `manifest.${key}`);
  const engines = ENGINE_CONTRACTS.map(contract => engine(resolvedRoot, contract, capabilities.get(contract.id)));
  const unavailableCapabilities = [...capabilities.values()]
    .filter(capability => capability.surface !== 'portable-text' || capability.status !== 'shipped')
    .map(capability => ({id:capability.id,status:capability.status,surface:capability.surface,scope:capability.scope}));

  return {
    product,
    catalog:{revision:provenance.revision,sha256:digest(resolvedCatalogPath)},
    engines,
    unavailableCapabilities,
    jointCompatibility:{status:'verified-declarations',label:'Pinned declarations verified, native connection not inspected'},
  };
}

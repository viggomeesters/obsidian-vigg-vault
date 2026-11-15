import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productOverview} from '../scripts/product-overview.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vigg-overview-'));
  cpSync('manifest.json', join(root, 'manifest.json'));
  cpSync('vendor', join(root, 'vendor'), {recursive:true});
  cpSync('scripts', join(root, 'scripts'), {recursive:true});
  cpSync('.cargo', join(root, '.cargo'), {recursive:true});
  cpSync('rust-toolchain.toml', join(root, 'rust-toolchain.toml'));
  const catalogPath = join(root, 'catalog.json');
  const provenancePath = join(root, 'catalog-provenance.json');
  // Use the real reviewed export bytes; fixtures must not relax the production pin.
  cpSync('vendor/product-capabilities.v1.json', catalogPath);
  const provenance = readJson('vendor/product-capabilities-provenance.json');
  writeJson(provenancePath, {...provenance,catalog:'catalog.json'});
  return {root,catalogPath,provenancePath};
}

function withFixture(run) {
  const paths = fixture();
  try { return run(paths); } finally { rmSync(paths.root, {recursive:true,force:true}); }
}

test('catalog lock rejects changed declarations even after provenance rehashing', () => {
  for (const mutate of [
    catalog => { catalog.unreviewed = true; },
    catalog => { catalog.capabilities[0].unreviewed = true; },
    catalog => { catalog.capabilities[0].scope = 'Invented wider authority'; },
    catalog => { catalog.capabilities[0].commands = ['invented-command']; },
    catalog => { catalog.capabilities[3].protocols = ['invented-native-protocol']; },
    catalog => { catalog.capabilities.reverse(); },
  ]) for (const replaceRevision of [false,true]) withFixture(paths => {
    const catalog = readJson(paths.catalogPath);
    mutate(catalog);
    writeJson(paths.catalogPath, catalog);
    const provenance = readJson(paths.provenancePath);
    provenance.sha256 = digest(readFileSync(paths.catalogPath));
    if (replaceRevision) provenance.revision = '0'.repeat(40);
    writeJson(paths.provenancePath, provenance);
    assert.throws(() => productOverview(paths));
  });
});

test('catalog lock rejects a different well-formed revision with unchanged bytes', () => withFixture(paths => {
  const provenance = readJson(paths.provenancePath);
  provenance.revision = '0'.repeat(40);
  writeJson(paths.provenancePath, provenance);
  assert.throws(() => productOverview(paths));
}));

test('build metadata derives product identity and accepts only declared portable contracts', () => withFixture(paths => {
  const overview = productOverview(paths);
  assert.deepEqual(overview.product, {id:'vigg-vault',name:'ViggVault',version:'0.4.0',minAppVersion:'1.13.1'});
  assert.equal(overview.engines.length, 3);
  assert.deepEqual(overview.engines.map(engine => engine.id), ['link-style-text','wiki-layout-text','activity-text']);
  assert.match(overview.catalog.sha256, /^[a-f0-9]{64}$/);
  assert.match(overview.catalog.revision, /^[a-f0-9]{40}$/);
  assert.deepEqual(overview.jointCompatibility, {status:'verified-declarations',label:'Pinned declarations verified, native connection not inspected'});
  assert.deepEqual(overview.unavailableCapabilities.map(capability => capability.id), ['source-preparation-native','vault-layout-native','package-lifecycle-native','visible-folder-entrance-proof']);
}));

test('build metadata fails closed for catalog, provenance, capability, schema and WASM mutations', () => withFixture(paths => {
  const expectFailure = mutate => {
    mutate();
    assert.throws(() => productOverview(paths));
  };
  const catalog = readJson(paths.catalogPath);
  catalog.schema = 'wrong';
  expectFailure(() => writeJson(paths.catalogPath, catalog));
}));

test('build metadata fails closed when catalog provenance, required capability, ruleset, source hash or WASM hash is wrong', () => {
  for (const mutation of [
    paths => { const provenance = readJson(paths.provenancePath); provenance.revision = 'not-a-revision'; writeJson(paths.provenancePath, provenance); },
    paths => { const catalog = readJson(paths.catalogPath); catalog.capabilities = catalog.capabilities.filter(capability => capability.id !== 'activity-text'); writeJson(paths.catalogPath, catalog); },
    paths => { const catalog = readJson(paths.catalogPath); catalog.capabilities.find(capability => capability.id === 'wiki-layout-text').rulesets = []; writeJson(paths.catalogPath, catalog); },
    paths => { const provenance = readJson(join(paths.root, 'vendor', 'provenance.json')); provenance.unchangedFiles['vendor/link-style-core/src/lib.rs'] = '0'.repeat(64); writeJson(join(paths.root, 'vendor', 'provenance.json'), provenance); },
    paths => { writeFileSync(join(paths.root, 'vendor', 'wasm', 'activity_core.wasm'), 'changed'); },
    paths => { rmSync(paths.catalogPath); },
  ]) withFixture(paths => {
    mutation(paths);
    assert.throws(() => productOverview(paths));
  });
});

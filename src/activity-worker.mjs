// Browser Worker boundary only. The Rust module contains all validation rules.
self.onmessage = async ({ data }) => {
  try {
    const module = await WebAssembly.compile(data.wasmBytes);
    if (WebAssembly.Module.imports(module).length !== 0) throw new Error("unexpected_wasm_imports");
    const instance = await WebAssembly.instantiate(module, {});
    const { memory, activity_request_buffer, activity_validate, activity_response_buffer } = instance.exports;
    const input = new TextEncoder().encode(JSON.stringify(data.snapshot));
    const pointer = activity_request_buffer(input.length);
    if (!pointer) throw new Error("request_limit");
    new Uint8Array(memory.buffer, pointer, input.length).set(input);
    const length = activity_validate();
    const output = new Uint8Array(memory.buffer, activity_response_buffer(), length);
    self.postMessage(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output)));
  } catch {
    self.postMessage({ schema: "viggobsidian.activity-result.v1", status: "incomplete", reason: "worker_failed" });
  }
};

# Think testing -- decisions out of the SDK file

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Testing

- **A module that imports `@cloudflare/think` cannot be collected by a
  node vitest runner**, so nothing in the composition root executes under
  any unit test. Therefore every decision (path admission, credential
  lifecycle, base-URL classification, the active tool list, upload
  policy) lives in a module with NO SDK import, exercised directly, and
  the subclass only wires. An adapter written in the untestable file is
  where the next defect goes: a mutation that redirected a manifest read
  to the wrong store left a whole suite green.
- Declare the shapes the SDK expects structurally in those modules (they
  are what `Think.fetchTools` or the tool factory accepts, so `tsc` checks
  the assignment at the composition root).
- Domain modules imported across a package boundary trip vite's per-file
  tsconfig discovery on a generated app tsconfig; pin
  `esbuild: { tsconfigRaw: '{}' }` (a STRING) and keep type checking in
  `tsc`.
- Object-level behaviour (state sync, hooks, recovery) is
  `@cloudflare/vitest-pool-workers` territory (radar Trial; the
  testing-node skill). Never hand-roll miniflare.
- **Evidence of a tool CALL is not evidence the tool WORKED.** A frame
  that fires before execution passes during the failure it exists to
  catch; assert on a non-failing result.
- Deployed: the liveness probe is `.../<agent>/<any-name>/get-messages`
  (a plain GET that instantiates one object and needs no model call).
  Then drive ONE real turn with a named case against a page whose content
  is known, through Access with a service token, and read the events. The
  probe stays green while the credential is dead, the model id is wrong,
  or the egress hop refuses you; only the turn proves the assistant
  answers.

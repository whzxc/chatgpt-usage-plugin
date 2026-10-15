# Agent Plugins schemas

Unmodified JSON Schema 2020-12 documents fetched on 2026-10-16:

- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json

`plugin-manifests.mjs` uses build-only Ajv to validate both portable files offline. It also checks package identity, launcher paths and agreement with the retained legacy manifests. The portable schema treats extension contents as opaque; OpenAI presentation metadata is checked against the legacy interface, not claimed to be validated by an OpenAI schema.

Refresh these files explicitly from the canonical URLs when adopting a new specification. Review field changes before updating manifests. Checks must never download schemas.

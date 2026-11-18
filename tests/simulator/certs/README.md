# Simulator TLS certs

The MITM proxy (`tests/simulator/proxy.ts`) terminates the CONNECT tunnels
for the simulated hosts with a test-only CA + server cert.

- **Committed:** `ca.crt`, `server.crt`, `generate.mjs` (public halves; the
  Firefox QA profile needs the CA present to import).
- **NOT committed (i6bf):** `ca.key`, `server.key`, `*.csr`, `ca.srl` —
  private key material is gitignored. `startSimulatorProxy` regenerates them
  on boot via `generate.mjs` when missing (a fresh clone gets a throwaway
  test CA); a failed generation is a hard, named error.
- **Never commit:** `certs/.mimosa/` (scanner session state).

Regenerate by hand after adding a simulated host (the SAN list lives in
`generate.mjs`):

```
node tests/simulator/certs/generate.mjs
```

The Chromium legs run with `--ignore-certificate-errors`; the download
manager verifies certificates OUTSIDE Playwright's reach, which is why every
simulated host must appear in these SANs.

// Pin Bun's TLS trust to the OS certificate store. Loaded from the image
// CMD as `bun run --preload <this file> <entry>`; the flag must come after
// `run` (placed before it, Bun prints the run usage and exits 0).
//
// Bun ships its own copy of the Mozilla root store, and `--use-system-ca`
// only *adds* the OS store to it, so a root that the OS has distrusted (e.g.
// the emSign roots after the 2026-10-20 eMudhra intermediate compromise)
// stays trusted until Bun itself releases. Restricting trust needs an
// explicit CA list, and Bun takes it from two places:
//   - node:tls / node:https (pg, ethers) use the process-wide default;
//   - fetch (viem, Discord, OAuth) ignores that default and takes `tls.ca`
//     per request, so it is wrapped below.
// The bundle is read from disk because tls.getCACertificates("system")
// returns nothing on Alpine. Fails closed: an empty bundle is a broken image.
import { readFileSync } from "node:fs";
import tls from "node:tls";

const CA_FILE =
  process.env.SSL_CERT_FILE ?? "/etc/ssl/certs/ca-certificates.crt";
const systemCa =
  readFileSync(CA_FILE, "utf8").match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
  ) ?? [];
if (systemCa.length === 0) {
  throw new Error(`bun-system-ca: no certificates in ${CA_FILE}`);
}

// Bun runtime APIs that the installed @types/node and DOM typings predate.
type BunTls = typeof tls & { setDefaultCACertificates(certs: string[]): void };
type BunRequestInit = RequestInit & { tls?: Record<string, unknown> };

(tls as BunTls).setDefaultCACertificates(systemCa);

const bunFetch = globalThis.fetch;
const pinnedFetch = (input: string | URL | Request, init?: BunRequestInit) =>
  bunFetch(input, {
    ...init,
    tls: { ca: systemCa, ...init?.tls },
  } as RequestInit);
globalThis.fetch = Object.assign(pinnedFetch, bunFetch);

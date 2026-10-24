# Isolated LaTeX compiler

The API never runs TeX on the request host in production. It forwards source to
this service (`POST /compile`), which compiles inside a disposable directory and
returns a PDF. The service is built to be deployed as a locked-down container:
no network, read-only root filesystem, non-root user, memory/CPU/PID caps, and a
hard wall-clock timeout.

## Why local compilation is risky

`latexService.js` can compile locally (Tectonic `--untrusted` or pdfLaTeX
`-no-shell-escape`) and that is what runs in development. Local compilation still
shares the API host, which means:

- **Resource competition.** TeX is CPU-hungry and can allocate large amounts of
  memory while typesetting. A wall-clock timeout plus `SIGKILL` bounds time, but
  not peak memory or CPU; several concurrent compiles can starve the API process.
- **Host filesystem access.** `openin_any=p` / `openout_any=p` and the command
  allowlist block `\input`, `\openin`, `\write18`, and similar, but the compiler
  still runs with the API user's filesystem view. Any future TeX engine or
  package bug that escapes the parser is a host compromise, not a container one.
- **Network egress.** On first use Tectonic downloads its bundle from the
  internet. That means the API host needs outbound access, and the compiler
  process can in principle reach anything the API host can.
- **Shared process tree.** A timeout kills the compiler; on POSIX the current
  implementation now kills the whole process group, but without cgroups there
  is still no PID or memory ceiling.
- **Blast radius of a kernel or engine bug.** No namespaces, no seccomp profile,
  no dropped capabilities, no read-only root filesystem.

The backend therefore refuses local compilation when `NODE_ENV=production`
unless `LATEX_ALLOW_LOCAL=true` is set explicitly. Treat that flag as a
deliberate downgrade for single-tenant deployments, not a supported production
mode.

## What this service enforces

| Control | Value | Where |
| --- | --- | --- |
| Bearer token | required, ≥16 chars, constant-time compare | `COMPILE_TOKEN` |
| Source size | 200,000 chars in the image (262,144 is the code default; `/healthz` reports the active value) | `MAX_SOURCE_BYTES` |
| Wall-clock timeout | 20s, process tree killed | `TIMEOUT_MS` |
| Output PDF size | 5 MiB, checked with `stat` before reading | `MAX_OUTPUT_BYTES` |
| Concurrency | 2 running, queue bounded by wait time | `MAX_CONCURRENCY`, `QUEUE_TIMEOUT_MS` |
| Shell escape | disabled | `--untrusted` |
| Bundle downloads | disabled in the image | `--only-cached` |
| File I/O commands | rejected before spawning (`\input`, `\openin`, `\openout`, `\write18`, `\immediate`, `\special`, `\directlua`, `\includegraphics`, …) | `BLOCKED` list |
| Dynamic command construction | `\csname` / `\endcsname` rejected, so `\csname input\endcsname` cannot reach `\input` | `BLOCKED` list |
| PDF-embedding primitives | `\XeTeXpdffile`, `\pdfximage` rejected | `BLOCKED` list |
| Temp files | fresh `mkdtemp`, mode 0600, removed in `finally` | `compile()` |
| Container | non-root `node`, read-only rootfs, `noexec` 64 MiB `/tmp`, `cap_drop: ALL`, `no-new-privileges`, 512 MiB RAM, 1 CPU, 64 PIDs, internal network | `Dockerfile`, `docker-compose.yml` |

The service is a second line of defence: the API already validates packages,
links, and forbidden commands before forwarding. Both validators carry the same
`\csname` and PDF-primitive blocks, so neither path can be used to reach a
filtered primitive.

**Tectonic does not honour Web2C/kpathsea limits.** `openin_any=p` and
`openout_any=p` are set for the pdfLaTeX fallback only. Measured against
Tectonic 0.17.0: `--untrusted` disables shell escape, but an absolute path is
still read (`\csname input\endcsname{C:/Windows/win.ini}` produced only a
"build may not be reproducible" warning and typeset the file). The command
filter above is therefore the barrier for file reads, and the container's
filesystem view bounds what a bypass could reach: no host mounts, and no
credentials on disk (the token lives only in the server's environment).

## Run it

Container (recommended):

```bash
cd latex-compiler
COMPILE_TOKEN="$(openssl rand -hex 32)" docker compose up -d --build
docker compose ps
```

The compose file publishes no host port and attaches the service to an internal
network, so only containers on `compiler_net` can reach it. Put the API on the
same network and point it at the service:

```
LATEX_COMPILE_URL=http://latex-compiler:8080/compile
LATEX_COMPILE_TOKEN=<the same token>
```

The image pins Tectonic 0.17.0 and verifies the release tarball's SHA-256. The
TeX bundle is warmed at build time so the runtime needs no internet.

On a laptop, run the service directly against a local Tectonic binary:

```bash
cd latex-compiler
COMPILE_TOKEN=local-development-token-1234 \
TECTONIC_BIN=../backend/.tools/tectonic.exe \
TECTONIC_ONLY_CACHED=false \
PORT=5070 node server.mjs
```

Then start the API with:

```
LATEX_COMPILE_URL=http://127.0.0.1:5070/compile
LATEX_COMPILE_TOKEN=local-development-token-1234
```

## Verify it

The contract and abuse tests are scripted, so the same checks can run against a
local process or the container:

```bash
# 17 checks: auth, shell escape, host-file reads, \csname bypass, PDF primitive,
# structure, size cap, credential leaks, temp-dir cleanup, timeout, PDF, queueing
SERVICE_URL=http://127.0.0.1:5070 COMPILE_TOKEN=local-development-token-1234 \
  node verify.mjs

# Inside the compose network, against the built image (service DNS name,
# COMPILE_TOKEN inherited from the compose environment)
docker compose run --rm -e SERVICE_URL=http://latex-compiler:8080 \
  --entrypoint node latex-compiler verify.mjs
```

Manual checks:

```bash
# Health
curl -s http://127.0.0.1:5070/healthz

# Unauthorised request -> 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:5070/compile \
  -H 'Content-Type: application/json' -d '{"source":"\\documentclass{article}\\begin{document}x\\end{document}"}'

# Real compile -> %PDF
curl -s -D /tmp/h.txt -o /tmp/out.pdf -X POST http://127.0.0.1:5070/compile \
  -H "Authorization: Bearer $COMPILE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source":"\\documentclass{article}\\begin{document}hello\\end{document}"}'
head -c 5 /tmp/out.pdf; echo; grep -i content-type /tmp/h.txt

# Forbidden command -> 400 with LATEX_FORBIDDEN_COMMAND
curl -s -X POST http://127.0.0.1:5070/compile \
  -H "Authorization: Bearer $COMPILE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source":"\\documentclass{article}\\begin{document}\\write18{id}\\end{document}"}'
```

The automated suite covers the API side of this contract
(`backend/test/latex.test.js`, plus the CDN-less unit tests).

## Process-level results (Docker absent)

Docker was not installed in the environment where this service was written, so
the container layer is **not** verified. Everything the container is meant to
guarantee was therefore measured at the process level, with the same Tectonic
binary and `--untrusted --only-cached` the image uses.

| Check | Result |
| --- | --- |
| Read-only Tectonic cache | **pass** — write access denied on the warmed cache tree (write probe denied, reads still allowed); `--only-cached` still produced a valid 3.4 KB PDF. The compose `read_only: true` + `/var/cache` layout is viable. |
| `\csname` filter bypass | **fixed** — `\csname input\endcsname{C:/Windows/win.ini}` was read by Tectonic and typeset while the literal `\input` filter saw nothing. Both validators now reject `\csname`, `\endcsname`, `\XeTeXpdffile`, `\pdfximage`. |
| Shell escape via construction | **pass** — `\csname write18\endcsname{echo PWNED > pwn.txt}` compiled without error and created no file: `--untrusted` stops shell escape at the engine. |
| PDF primitive reading a host file | **pass** — `\XeTeXpdffile "C:/Windows/win.ini"` produced no PDF (parse failure); now rejected earlier with `400`. |
| Queue saturation | **pass** — `MAX_CONCURRENCY=1`, `QUEUE_TIMEOUT_MS=3000`, three runaway documents at once: the running one got `504 LATEX_TIMEOUT` at 12 s, both queued requests got `503 LATEX_BUSY` at ~6 s instead of piling up. |
| Credentials in error bodies | **pass** — 8 error responses (401/400/413) contained neither the token nor the string `COMPILE_TOKEN`. |
| Temp cleanup | **pass** — 0 `latex-compile-*` directories left after rejections, a timeout and a successful compile. |
| Production fallback | **pass** — `NODE_ENV=production` with no `LATEX_COMPILE_URL` reports `mode: "unavailable"` and `compileLatex` throws `LATEX_LOCAL_DISABLED` (503) even though a local `tectonic.exe` exists. |

## Container checks still outstanding

These were **not** executed here. Run them on a Docker-enabled machine before
trusting the container layer:

```bash
cd latex-compiler
export COMPILE_TOKEN="$(openssl rand -hex 32)"
docker compose build
docker compose up -d
docker compose ps                       # expect healthy after ~10s
docker inspect --format '{{.State.Health.Status}}' $(docker compose ps -q)

# The service must not be reachable from the host (no published port)
curl -s -m 3 http://127.0.0.1:8080/healthz; echo "exit=$?"   # expect connection failure

# Run the full contract suite inside the network, then check the hard limits
docker compose run --rm -e SERVICE_URL=http://latex-compiler:8080 \
  --entrypoint node latex-compiler verify.mjs
docker stats --no-stream $(docker compose ps -q)              # peak under 512 MiB
docker exec $(docker compose ps -q) sh -c 'ps -o pid,rss,comm | head' # non-root, few procs

# Confirm no egress: the container must not resolve or fetch anything
docker compose run --rm --entrypoint sh latex-compiler -c \
  'node -e "fetch(\"https://example.com\").then(()=>console.log(\"EGRESS OPEN\")).catch(e=>console.log(\"egress blocked:\",e.message))"'

# Confirm the root filesystem is read-only
docker compose run --rm --entrypoint sh latex-compiler -c 'touch /nope'   # expect permission denied
```

PowerShell equivalents:

```powershell
cd latex-compiler
$env:COMPILE_TOKEN = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
docker compose build
docker compose up -d
docker compose ps
docker inspect --format '{{.State.Health.Status}}' (docker compose ps -q)

# expect a connection error: no port is published
Invoke-WebRequest -Uri http://127.0.0.1:8080/healthz -TimeoutSec 3 -ErrorAction SilentlyContinue

docker compose run --rm -e SERVICE_URL=http://latex-compiler:8080 `
  --entrypoint node latex-compiler verify.mjs
docker exec (docker compose ps -q) sh -c "touch /nope"        # Read-only file system
docker stats --no-stream (docker compose ps -q)
docker compose run --rm --entrypoint node latex-compiler -e "fetch('https://example.com').then(()=>console.log('EGRESS OPEN')).catch(e=>console.log('egress blocked:',e.message))"
```

One trap in the bash block above: `docker compose run` starts a **separate**
container, so `verify.mjs`'s temp-directory checks inspect that container's
`/tmp`, not the service's. Check the service explicitly:

```bash
docker exec "$(docker compose ps -q)" sh -c 'ls -d /tmp/latex-compile-* 2>/dev/null | wc -l'   # expect 0
```

Watch for one specific failure (contingency only — the process-level test above
says it is not expected): Tectonic may want to create a lock file inside
`XDG_CACHE_HOME` (`/var/cache`), which is read-only at runtime. If the first
compile fails with a cache/read-only error, mount a writable copy instead of a
tmpfs over the warmed cache, for example add to `docker-compose.yml`:

```yaml
    entrypoint: ["sh", "-c", "cp -a /var/cache /tmp/texcache && XDG_CACHE_HOME=/tmp/texcache exec node server.mjs"]
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=256m
```

(`/tmp` must then hold the ~44 MB bundle plus the compile workspace.)

## Limits and remaining work

- The container runtime itself was **not** executed in this environment (no
  Docker, no WSL, no podman). The service process, contract, limits and API
  integration were verified with the same Tectonic binary and flags the image
  uses, including a read-only cache; see "Process-level results" above for the
  exact evidence and "Container checks still outstanding" for what remains.
- Tectonic 0.17.0 reads absolute paths even with `--untrusted`; only shell
  escape is disabled. The command filter (now including `\csname`) and the
  container's filesystem view are what constrain reads. Never enable
  `LATEX_ALLOW_LOCAL` on a host that holds credentials.
- There is no per-user quota here; the API's rate limiter and the queue depth are
  the backstops. A production deployment should also cap concurrent compiles per
  account and alert on queue saturation.
- The compiler returns TeX logs to the caller for error messages; logs can echo
  document content. Do not enable `LOG_RESPONSE` if logs must not leave the
  isolated environment.
- Multi-architecture images need the matching Tectonic asset and checksum
  (`aarch64-unknown-linux-musl` for arm64).

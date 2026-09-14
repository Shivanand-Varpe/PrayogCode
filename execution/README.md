# PrayogCode C Execution Docker Environment

## Purpose

This environment provides an isolated, containerized Linux runtime for compiling and running untrusted C source code. It represents the first step of **Stage 3** in moving PrayogCode from host-level execution toward hardened, multi-tenant container isolation.

At this stage (Stage 3, Step 1), the Docker runner operates independently of the WebSocket backend and frontend, enabling safe offline verification and hardening before integration.

---

## Build

To build the minimal C execution Docker image:

```powershell
docker build -t prayogcode-c-runner execution
```

The resulting image (`prayogcode-c-runner`) is based on Alpine Linux 3.20 with GCC and musl libc, resulting in a lightweight footprint (~157 MiB) with no extra runtimes (no Node.js, Python, or database engines).

---

## Test Hello World

Compile and run standard C source code using security flags and a read-only mounted volume:

```powershell
docker run --rm --network none --cpus 1 --memory 128m --pids-limit 64 --read-only --tmpfs /tmp:rw,exec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges:true -v "${PWD}/execution/test:/test:ro" prayogcode-c-runner sh -c "gcc -O2 /test/hello.c -o /tmp/hello && /tmp/hello"
```

**Expected Output:**
```
Hello from PrayogCode Docker!
```

---

## Test Interactive Input

Verify interactive standard input (`scanf`) streaming into the running C container:

```powershell
echo "10 20" | docker run --rm -i --network none --cpus 1 --memory 128m --pids-limit 64 --read-only --tmpfs /tmp:rw,exec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges:true -v "${PWD}/execution/test:/test:ro" prayogcode-c-runner sh -c "gcc -O2 /test/input.c -o /tmp/input && /tmp/input"
```

**Expected Output:**
```
Enter two numbers: Sum = 30
```

---

## Test Timeout

Simulate orchestrator/backend execution timeout by stopping an infinite loop container after a time limit:

```powershell
$id = docker run -d --rm --network none --cpus 1 --memory 128m --pids-limit 64 --read-only --tmpfs /tmp:rw,exec,nosuid,size=64m -v "${PWD}/execution/test:/test:ro" prayogcode-c-runner sh -c "gcc -O2 /test/loop.c -o /tmp/loop && /tmp/loop"
Start-Sleep -Seconds 2
docker stop -t 1 $id
```

The container starts in detached mode, executes `loop.c`, and is cleanly stopped and automatically removed after the timer expires.

---

## Verify Non-Root

Confirm that processes run under the dedicated unprivileged user `prayog` (`uid=1000`, `gid=1000`):

```powershell
docker run --rm prayogcode-c-runner id
```

**Expected Output:**
```
uid=1000(prayog) gid=1000(prayog) groups=1000(prayog),1000(prayog)
```

---

## Verify Network Isolation

Confirm that outgoing socket creation and network connectivity are completely disabled:

```powershell
docker run --rm --network none prayogcode-c-runner ping -c 1 8.8.8.8
```

**Expected Output:**
```
ping: sendto: Network unreachable
```

---

## Resource Limits

The container runtime is constrained by cgroups to prevent host resource starvation:

- `--cpus 1`: Limits the C process to a maximum of 1 CPU core.
- `--memory 128m`: Restricts container RAM usage to 128 MB.
- `--pids-limit 64`: Prevents fork-bombing by capping concurrent processes to 64.

To verify applied cgroup constraints:

```powershell
# Verify memory limit (134217728 bytes = 128 MB)
docker run --rm --memory 128m prayogcode-c-runner cat /sys/fs/cgroup/memory.max

# Verify PID limit (64)
docker run --rm --pids-limit 64 prayogcode-c-runner cat /sys/fs/cgroup/pids.max
```

---

## Filesystem Isolation

The container runs with a read-only root filesystem (`--read-only`), preventing unauthorized file creation or tampering:

- **Root Filesystem**: Read-only (`/`, `/usr`, `/lib` are immutable).
- **Temporary Execution Area**: Ephemeral in-memory tmpfs mounted at `/tmp` (`--tmpfs /tmp:rw,exec,nosuid,size=64m`).
- **Source Mounts**: Read-only bind mounts (`-v "${PWD}/execution/test:/test:ro"`).

To verify filesystem write restrictions:

```powershell
docker run --rm --read-only --tmpfs /tmp:rw,exec,nosuid,size=64m prayogcode-c-runner sh -c "touch /cant_write 2>&1; touch /tmp/can_write && echo 'tmpfs write succeeded'"
```

**Expected Output:**
```
touch: /cant_write: Read-only file system
tmpfs write succeeded
```

---

## Cleanup

To prune stopped test containers or delete the test runner image:

```powershell
# Remove any stopped test containers
docker container prune -f

# Remove the test runner image
docker rmi prayogcode-c-runner
```

---

## Security Notes

1. **Development Sandboxing**: The configurations provided in this guide establish baseline isolation (unprivileged user, no network, read-only rootfs, memory/PID caps, dropped Linux capabilities).
2. **Production Hardening Prerequisite**: Prior to exposing code execution to arbitrary, unauthenticated public web users, further layers should be evaluated:
   - Kernel sandboxing with **gVisor (`runsc`)** or **nsjail** to mitigate Linux kernel 0-day exploits.
   - MicroVM isolation (such as Firecracker) for shared cloud infrastructure.
   - Strict wall-clock execution limits and egress network blocking at the host firewall level.


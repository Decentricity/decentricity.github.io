[Slide 1 - Why systemd matters]
[systemd is the service manager on Ubuntu; learning it gives you reliable startup, recovery, and observability for almost every server workload.]
```bash
ps -p 1 -o comm=
systemctl --version
```

[Slide 2 - Unit types at a glance]
[The most common unit is `service`, but real operations also use `socket`, `timer`, `mount`, and `target` units to model dependencies.]
```bash
systemctl list-unit-types
systemctl list-units --type=service --state=running
```

[Slide 3 - Unit file locations]
[Vendor unit files usually live in `/lib/systemd/system`, while your custom and override files belong in `/etc/systemd/system`.]
```bash
ls /lib/systemd/system | head
ls /etc/systemd/system
```

[Slide 4 - Read an existing service]
[Before writing your own unit, inspect a known-good one to understand directives, ordering, and restart behavior.]
```bash
systemctl cat ssh
systemctl show ssh --no-pager | grep -E '^(Type|Restart|ExecStart)='
```

[Slide 5 - Minimal custom service]
[Start with a simple service that runs a script; keep it explicit and fail-fast for easier debugging.]
```bash
sudo tee /etc/systemd/system/hello.service >/dev/null <<'UNIT'
[Unit]
Description=Hello Demo Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hello.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
```

[Slide 6 - Create the script safely]
[Your script should include a shebang, strict shell options, and log output to stdout/stderr so journald captures it.]
```bash
sudo tee /usr/local/bin/hello.sh >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
while true; do
  echo "hello-service alive at $(date -Is)"
  sleep 10
done
SCRIPT
sudo chmod +x /usr/local/bin/hello.sh
```

[Slide 7 - daemon-reload and first start]
[After creating or changing unit files, reload systemd metadata, then start and inspect the service state.]
```bash
sudo systemctl daemon-reload
sudo systemctl start hello.service
systemctl status hello.service --no-pager
```

[Slide 8 - Enable on boot]
[Enabling creates symlinks into targets so the service starts automatically after reboot, not just in the current session.]
```bash
sudo systemctl enable hello.service
systemctl is-enabled hello.service
```

[Slide 9 - Service states and failure signals]
[Use `is-active`, `is-failed`, and exit codes to quickly classify incidents before deep investigation.]
```bash
systemctl is-active hello.service
systemctl is-failed hello.service
systemctl show hello.service -p ActiveState -p SubState -p Result
```

[Slide 10 - Journal basics]
[`journalctl` is your default service log source; filter by unit name and reverse output for fast incident triage.]
```bash
journalctl -u hello.service -n 50 --no-pager
journalctl -u hello.service -r --no-pager | head
```

[Slide 11 - Time-based log filtering]
[Pin logs to incident windows to reduce noise and align events with user reports or monitoring alerts.]
```bash
journalctl -u hello.service --since "10 minutes ago" --no-pager
journalctl -u hello.service --since "2026-02-12 09:00:00" --until "2026-02-12 09:30:00"
```

[Slide 12 - Live log streaming]
[Follow logs in real time while testing changes so you can validate behavior and detect regressions instantly.]
```bash
journalctl -u hello.service -f
```

[Slide 13 - Restart policy deep dive]
[`Restart=on-failure` is a safe default; tune `RestartSec` and start limits to avoid crash loops and alert storms.]
```bash
sudo systemctl edit hello.service
# Add:
# [Service]
# Restart=on-failure
# RestartSec=5
# StartLimitIntervalSec=60
# StartLimitBurst=3
```

[Slide 14 - Dependency ordering]
[Use `After=` for order and `Wants=` or `Requires=` for relationships; order alone does not imply dependency.]
```bash
systemctl show hello.service -p After -p Wants -p Requires
systemctl list-dependencies hello.service
```

[Slide 15 - Environment variables]
[Inject settings through `Environment=` or `EnvironmentFile=` to avoid hardcoding values directly in scripts.]
```bash
sudo systemctl edit hello.service
# [Service]
# Environment="APP_ENV=prod" "SLEEP_SECONDS=10"
```

[Slide 16 - Override without touching vendor files]
[Use drop-ins with `systemctl edit` so package upgrades do not overwrite your local service changes.]
```bash
sudo systemctl edit nginx
systemctl cat nginx
```

[Slide 17 - Validate unit syntax]
[Run a verification pass before restart to catch typos and invalid directives early.]
```bash
sudo systemd-analyze verify /etc/systemd/system/hello.service
```

[Slide 18 - Resource controls with cgroups]
[Systemd can enforce CPU and memory limits per service, preventing one process from exhausting the host.]
```bash
sudo systemctl set-property hello.service CPUQuota=50% MemoryMax=200M
systemctl show hello.service -p CPUQuotaPerSecUSec -p MemoryMax
```

[Slide 19 - Safe deployment pattern]
[Use a repeatable flow: edit, verify, reload, restart, status, logs. This reduces risky ad-hoc changes in production.]
```bash
sudoedit /etc/systemd/system/hello.service
sudo systemd-analyze verify /etc/systemd/system/hello.service
sudo systemctl daemon-reload && sudo systemctl restart hello.service
systemctl status hello.service --no-pager
journalctl -u hello.service -n 30 --no-pager
```

[Slide 20 - Cleanup and rollback]
[Know how to disable and remove a bad unit cleanly, then return to a stable baseline.]
```bash
sudo systemctl disable --now hello.service
sudo rm -f /etc/systemd/system/hello.service /usr/local/bin/hello.sh
sudo systemctl daemon-reload
sudo systemctl reset-failed
```

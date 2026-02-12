[Slide 1 - Performance triage mindset]
[First classify the bottleneck domain (CPU, memory, disk, network) before tuning; random tweaks waste time.]
```bash
date
uptime
```

[Slide 2 - Load average vs CPU usage]
[Load average is runnable or waiting tasks, not direct CPU percent; high load with low CPU often means I/O wait.]
```bash
uptime
mpstat 1 5
```

[Slide 3 - Fast system snapshot]
[Capture one baseline snapshot with host, kernel, uptime, memory, and disk to anchor all later comparisons.]
```bash
hostnamectl
free -h
df -h
```

[Slide 4 - top and htop essentials]
[Sort by CPU or memory and inspect process states to identify immediate top offenders.]
```bash
top -o %CPU
htop
```

[Slide 5 - CPU bottleneck indicators]
[Look for sustained high user/system CPU, run queue growth, and hot processes pinned across cores.]
```bash
mpstat -P ALL 1 5
ps -eo pid,comm,%cpu --sort=-%cpu | head
```

[Slide 6 - Context switches and run queue]
[Excessive context switching and long run queues can indicate thread contention or too many runnable tasks.]
```bash
vmstat 1 10
```

[Slide 7 - Memory pressure basics]
[Low free memory is normal on Linux; focus on swap activity, reclaim behavior, and OOM events.]
```bash
free -h
vmstat 1 10
```

[Slide 8 - Detect OOM and reclaim pain]
[Kernel logs reveal OOM kills and memory pressure that user-space tools may miss.]
```bash
dmesg -T | grep -Ei 'out of memory|oom|killed process' | tail -n 20
journalctl -k --since "1 hour ago" --no-pager
```

[Slide 9 - Disk capacity vs disk performance]
[Separate full-disk incidents from slow-disk incidents; both break apps but need different fixes.]
```bash
df -h
lsblk -o NAME,FSTYPE,SIZE,MOUNTPOINT,ROTA
```

[Slide 10 - Disk I/O saturation]
[Use `iostat` to detect high utilization and await times indicating storage queue congestion.]
```bash
iostat -xz 1 10
```

[Slide 11 - Process-level I/O culprits]
[Identify which processes generate the most read/write pressure before changing storage config.]
```bash
sudo iotop -oPa
pidstat -d 1 5
```

[Slide 12 - Network triage quick checks]
[Start with socket states and interface counters to distinguish app issues from transport issues.]
```bash
ss -s
ip -s link
```

[Slide 13 - Connection-level inspection]
[Find backlog, retransmits, and anomalous connection growth during service degradation.]
```bash
ss -tuna | head -n 30
ss -lntp
```

[Slide 14 - DNS and latency sanity checks]
[Slow DNS resolution often looks like random app slowness; test name lookup and endpoint latency directly.]
```bash
resolvectl status
getent hosts example.com
ping -c 4 8.8.8.8
```

[Slide 15 - Kernel signal correlation]
[Correlate spikes with kernel warnings: NIC resets, filesystem errors, soft lockups, or cgroup throttling.]
```bash
journalctl -k --since "30 minutes ago" --no-pager | tail -n 100
```

[Slide 16 - Service-level perspective]
[Host metrics are incomplete without service health, restart loops, and application-level error rate context.]
```bash
systemctl --failed
systemctl status nginx --no-pager
journalctl -u nginx --since "30 minutes ago" --no-pager | tail -n 50
```

[Slide 17 - Bottleneck decision tree]
[Decision pattern: high CPU busy -> CPU path; high await -> disk path; swap/OOM -> memory path; retransmits/timeouts -> network path.]
```bash
# CPU: mpstat, top
# MEM: free, vmstat, dmesg
# DISK: iostat, iotop
# NET: ss, ip -s link
```

[Slide 18 - Safe immediate mitigations]
[Apply reversible mitigations first: restart stuck service, free disk, scale workers, or rate-limit abusive traffic.]
```bash
sudo systemctl restart myservice
sudo journalctl --vacuum-time=7d
sudo ufw limit 443/tcp
```

[Slide 19 - Capture evidence for postmortem]
[During incidents, gather timestamped command output so root cause analysis is based on facts, not memory.]
```bash
ts=$(date +%F_%H%M%S)
mkdir -p /tmp/perf-$ts
( uptime; free -h; df -h; ss -s; vmstat 1 5 ) | tee /tmp/perf-$ts/snapshot.txt
```

[Slide 20 - Performance operations checklist]
[Turn triage into habit: baseline weekly, alert on saturation, review trends, and rehearse incident response.]
```bash
# Weekly routine:
# 1) Review CPU/mem/disk/net trends
# 2) Verify alert thresholds
# 3) Run mini-triage drill
```

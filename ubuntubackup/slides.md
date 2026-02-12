[Slide 1 - Backup is not recovery]
[A successful backup job does not guarantee recovery; only tested restores prove resilience.]
```bash
date
hostnamectl
```

[Slide 2 - Define RPO and RTO]
[RPO is acceptable data loss window; RTO is acceptable downtime window. These values drive backup design.]
```bash
# Example targets:
# RPO = 1 hour
# RTO = 2 hours
```

[Slide 3 - What to back up first]
[Prioritize irreplaceable data: databases, app data, configs, secrets, and automation scripts.]
```bash
sudo du -sh /etc /var/lib /home 2>/dev/null
sudo find /etc -maxdepth 2 -type f | head
```

[Slide 4 - Backup scope inventory]
[Create a written inventory mapping each data set to owner, location, retention, and restore priority.]
```bash
lsblk -f
mount | column -t | head -n 20
```

[Slide 5 - Full vs incremental backups]
[Full backups are simple but heavy; incrementals reduce storage and time but complicate restore chains.]
```bash
# Strategy example:
# Weekly full + daily incremental
```

[Slide 6 - Local backup with rsync]
[`rsync` is a practical baseline for filesystem backups with preserve flags and delete control.]
```bash
sudo rsync -aHAX --delete /etc /home /var/lib /backup/daily/
```

[Slide 7 - Exclusion and risk control]
[Exclude ephemeral paths and caches to reduce noise; never exclude critical state by accident.]
```bash
sudo rsync -aHAX --delete \
  --exclude='/var/cache/*' \
  --exclude='/tmp/*' \
  / /backup/rootfs/
```

[Slide 8 - Compression and archives]
[Archive snapshots make transport easy; choose compression based on CPU budget and restore speed needs.]
```bash
sudo tar -C / -czf /backup/etc-home-$(date +%F).tar.gz etc home
ls -lh /backup | tail
```

[Slide 9 - Encryption at rest]
[Backups often contain secrets; encrypt archives before offsite transfer or cloud storage.]
```bash
gpg --symmetric --cipher-algo AES256 /backup/etc-home-2026-02-12.tar.gz
```

[Slide 10 - Offsite and 3-2-1 rule]
[Keep 3 copies, 2 media types, and 1 offsite copy to survive device loss or site incidents.]
```bash
rclone copy /backup remote:server-backups --progress
```

[Slide 11 - Automate backup jobs]
[Schedule backups with timers or cron; log output and alert on failures to avoid silent drift.]
```bash
crontab -e
# 0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1
```

[Slide 12 - Validate backup contents]
[Verify that expected files exist and checksums match to catch corruption early.]
```bash
find /backup/daily/etc -type f | wc -l
sha256sum /backup/etc-home-2026-02-12.tar.gz
```

[Slide 13 - Restore test: single file]
[Start with granular restores because most incidents are accidental deletion or bad config changes.]
```bash
sudo cp /backup/daily/etc/ssh/sshd_config /etc/ssh/sshd_config.restore
sudo diff -u /etc/ssh/sshd_config /etc/ssh/sshd_config.restore | head
```

[Slide 14 - Restore test: service data]
[Test restoring app or database directories in a staging path before touching production data.]
```bash
sudo mkdir -p /restore-test
sudo rsync -aHAX /backup/daily/var/lib/myapp/ /restore-test/myapp/
```

[Slide 15 - Bare metal recovery outline]
[Document order of operations: OS install, package restore, config restore, data restore, validation.]
```bash
# Recovery runbook skeleton:
# 1) Install Ubuntu
# 2) Install dependencies
# 3) Restore /etc and app data
# 4) Start services and verify
```

[Slide 16 - Measure real RTO]
[Time the full restore drill end-to-end and compare with target RTO to expose operational gaps.]
```bash
start=$(date +%s)
# perform restore steps
end=$(date +%s)
echo "Restore duration: $((end-start)) seconds"
```

[Slide 17 - Common backup failures]
[Frequent issues include missing permissions, full disks, stale mounts, and unmonitored cron failures.]
```bash
df -h
journalctl -u cron --since "24 hours ago" --no-pager
```

[Slide 18 - Immutable and versioned backups]
[Versioning and immutability protect against ransomware and operator mistakes that delete recent backups.]
```bash
# Example with borg (append-only remote suggested):
# borg create --stats repo::'{hostname}-{now}' /etc /home /var/lib
```

[Slide 19 - Restore acceptance checklist]
[A restore is complete only when service health, data integrity, permissions, and user access all validate.]
```bash
systemctl --failed
sudo find /restore-test -type f | wc -l
sudo grep -R "ERROR" /var/log | tail
```

[Slide 20 - Team backup operating rhythm]
[Assign ownership, test monthly, review retention quarterly, and update runbooks after every incident.]
```bash
# Monthly:
# - Run restore drill
# - Update backup inventory
# - File post-drill notes in runbook
```

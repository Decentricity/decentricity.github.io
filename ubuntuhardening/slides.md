[Slide 1 - Hardening goals]
[Baseline hardening reduces common attack paths while preserving admin access and service availability.]
```bash
uname -a
lsb_release -a
```

[Slide 2 - Security model for small teams]
[Start with least privilege, minimal open ports, and key-based SSH; these controls stop most opportunistic attacks.]
```bash
id
sudo -l
```

[Slide 3 - Quick exposure audit]
[Before changing rules, identify listening services and network paths that are currently reachable.]
```bash
ss -tulpen
sudo lsof -i -P -n | grep LISTEN
```

[Slide 4 - UFW fundamentals]
[UFW is an Ubuntu-friendly firewall frontend for nftables/iptables with simple allow-deny semantics.]
```bash
sudo ufw status verbose
sudo ufw app list
```

[Slide 5 - Default deny baseline]
[Set inbound traffic to deny by default and outbound to allow, then open only required service ports.]
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

[Slide 6 - Allow SSH safely]
[Always allow SSH before enabling UFW to prevent locking yourself out of remote servers.]
```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status numbered
```

[Slide 7 - Add web service rules]
[Explicitly allow only ports for active workloads, such as HTTP and HTTPS for web servers.]
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status verbose
```

[Slide 8 - Restrict admin source ranges]
[Limit SSH access to known admin IP ranges where possible to reduce brute-force and scanning risk.]
```bash
sudo ufw delete allow OpenSSH
sudo ufw allow from 203.0.113.0/24 to any port 22 proto tcp
```

[Slide 9 - Logging and rule review]
[Firewall logs support incident response and should be reviewed after policy changes.]
```bash
sudo ufw logging medium
sudo tail -n 50 /var/log/ufw.log
```

[Slide 10 - SSH key-only authentication]
[Disabling password auth significantly cuts automated credential attacks against SSH.]
```bash
sudoedit /etc/ssh/sshd_config
# PasswordAuthentication no
# PubkeyAuthentication yes
sudo sshd -t
sudo systemctl reload ssh
```

[Slide 11 - Disable root SSH login]
[Direct root login removes accountability and raises risk; require named accounts plus sudo instead.]
```bash
sudoedit /etc/ssh/sshd_config
# PermitRootLogin no
sudo sshd -t && sudo systemctl reload ssh
```

[Slide 12 - Move SSH port (optional)]
[Changing SSH port is not a primary control but reduces commodity noise in logs.]
```bash
sudoedit /etc/ssh/sshd_config
# Port 2222
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
sudo sshd -t && sudo systemctl reload ssh
```

[Slide 13 - Connection rate limiting]
[Rate limits slow brute-force attempts without blocking legitimate occasional retries.]
```bash
sudo ufw limit 22/tcp
sudo ufw status numbered
```

[Slide 14 - Fail2ban concept]
[Fail2ban monitors logs and temporarily bans abusive IPs based on repeated authentication failures.]
```bash
sudo apt update
sudo apt install -y fail2ban
systemctl status fail2ban --no-pager
```

[Slide 15 - Configure fail2ban jail]
[Use local overrides in `jail.local` to protect SSH while preserving package defaults in `jail.conf`.]
```bash
sudo tee /etc/fail2ban/jail.local >/dev/null <<'JAIL'
[sshd]
enabled = true
bantime = 1h
findtime = 10m
maxretry = 5
JAIL
sudo systemctl restart fail2ban
```

[Slide 16 - Validate bans and health]
[Check jail status and banned IP counters to verify fail2ban is actively enforcing policy.]
```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

[Slide 17 - Account and sudo hygiene]
[Harden local accounts by removing unused users, enforcing sudo discipline, and auditing privileged access.]
```bash
getent passwd | cut -d: -f1
getent group sudo
sudo lastlog | head
```

[Slide 18 - Patch and upgrade baseline]
[Most hardening failures come from unpatched systems; define a repeatable patch cadence and reboot process.]
```bash
sudo apt update
apt list --upgradable
sudo unattended-upgrades --dry-run --debug
```

[Slide 19 - Hardening verification checklist]
[Convert hardening into objective checks so new servers are validated consistently.]
```bash
sudo ufw status verbose
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|port'
sudo fail2ban-client status sshd
```

[Slide 20 - Recovery plan to avoid lockout]
[Every hardening change should include backout steps and an out-of-band access method.]
```bash
# Keep one active SSH session open while testing.
# If locked out via console:
sudo ufw disable
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
sudo systemctl restart ssh
```

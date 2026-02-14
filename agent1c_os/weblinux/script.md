# Speaker Notes – Virtual Hosts + TLS Basics (Deep Cut)

General tone for delivery: conversational, empathetic; assume students are new to web hosting and TLS but comfortable running commands when told why. Repeat key terms, demo live wherever possible.

---

## Slide 1 – Title / Outcomes
- Open with the promise: “In ~90 minutes you’ll host two sites on one Ubuntu server and lock them down with HTTPS.”
- Clarify tools: nginx/Apache (pick one to demo), systemd for lifecycle, certbot/openssl for certs.
- Pre-empt fear: “We’ll stay in copy/paste friendly commands and explain each flag before we run it.”
- Extra commands to have handy: `hostnamectl` (show OS), `lsb_release -a` (distro info) to prove environment.

## Slide 2 – Lab Setup with Multipass
- Anecdote: “Local VMs avoid hotel Wi‑Fi chaos; everyone gets the same box.”
- Explain Multipass conceptually: lightweight Ubuntu VMs managed from host; no VirtualBox UI clicking.
- Command meaning: `multipass exec VM -- <cmd>` = run a command inside VM without SSH shell.
- Helpful extras: `multipass list` (see state/IP), `multipass info web` (details), `multipass shell web` (interactive fallback).

## Slide 3 – Create the VM
- Walk through `multipass launch --name web --cpus 2 --mem 2G --disk 10G 22.04`: name, resources, image version.
- Note deletion safety: `multipass delete web && multipass purge` to reset if you break things.
- Common confusion: disk size is sparse; it won’t eat full 10G immediately.
- Alternative command: `multipass find | head` to show available images; pick LTS for stability.

## Slide 4 – Running Commands in the VM
- Show `multipass exec web -- sudo apt update` and explain sudo is inside the VM, not host.
- Mention `--` delimiter importance; without it, flags may be parsed by multipass, not the command.
- Tip: for multi-line scripts use `bash -lc '...'` inside exec.
- Debug aid: if a command “hangs,” add `-v` to multipass for verbose logging.

## Slide 5 – Testing from Host
- Concept: VM gets its own IP on your laptop’s network; you can curl it directly.
- Command meaning: `curl -I http://<VM_IP>/` fetches headers only (lightweight health check).
- `/etc/hosts` optional polish; show `printf "<IP> site1.test\n" | sudo tee -a /etc/hosts`.
- Quick IP discovery: `multipass list` or inside VM `ip -4 -br a`.

## Slide 6 – Mental Model: One Server, Many Sites
- Visual: one IP, many domains; routing decided by Host header inside the HTTP request.
- Use `dig +short site1.test` when DNS exists; otherwise emphasize Host header testing.
- Mention capacity: modern web servers easily handle hundreds of vhosts; the bottleneck is usually config, not tech.

## Slide 7 – Ports 80/443
- Why special: 80/443 are defaults browsers assume; below 1024 requires root/capabilities.
- Show `ss -lntp | head` and explain columns: State, Recv-Q, Send-Q, Local Address:Port, Peer, PID/Program.
- Extra: `sudo setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx` allows binding 80/443 without running as root (already packaged on Ubuntu but good trivia).

## Slide 8 – Host Header
- Explain HTTP/1.1 required Host header; servers use it to pick vhost.
- Demo `curl -v http://<IP>/` and point to the `Host:` line in request.
- Note for HTTP/2 the :authority pseudo-header maps to Host; same idea.

## Slide 9 – Host Header Demo
- Run both: `curl -H 'Host: site1.test' http://<IP>/` and `site2.test`; show different bodies.
- Pitfall: forgetting quotes when header has colon; remind students curl auto-adds colon syntax.
- Alternative: `httpie` style `http http://<IP>/ Host:site1.test` if they like friendlier CLI.

## Slide 10 – Name vs IP-Based Vhosting
- Name-based default for most web; IP-based only when legacy TLS/no-SNI clients or dedicated IP needs.
- Use `ip -4 addr show` to check if machine even has multiple IPs; most lab VMs have one.
- Anecdote: “Old IE on Windows XP pre-SP3 lacked SNI; practically gone, but banking kiosks sometimes still care.”

## Slide 11 – DNS Basics Needed
- A/AAAA records: map names to IPv4/6; CNAME points name→name.
- TTL: how long resolvers cache; low TTL handy during cutovers.
- Commands: `dig +short A example.com`, `dig +trace example.com`, `getent hosts example.com` (uses system resolver stack).
- Clarify that lab may skip real DNS entirely.

## Slide 12 – Local Testing with /etc/hosts
- `/etc/hosts` overrides DNS locally; format `<IP> name1 name2`.
- Safety: use `sudo sh -c 'echo "IP site1.test" >> /etc/hosts'` to avoid redirection without sudo.
- To undo: `sudo sed -i '/site1.test/d' /etc/hosts`.

## Slide 13 – Web Roots
- Recommend `/var/www/site1` and `/var/www/site2`; separation simplifies perms and logs.
- Ownership model: deployment user writes, web server reads. In labs, `www-data:www-data` is fine.
- Command refresher: `sudo install -d -o www-data -g www-data /var/www/site1` creates dir with ownership in one go.

## Slide 14 – Create Two Pages
- Keep HTML minimal and distinct; color or text differences help sanity checks.
- Commands: `cat <<'EOF' | sudo tee /var/www/site1/index.html` etc.
- Reminder to set permissions if editing as root: `sudo chown -R www-data:www-data /var/www/site1`.

## Slide 15 – Nginx vs Apache Vhost Shape
- Nginx “server block” vs Apache `<VirtualHost>`; both support name-based vhosts.
- Install commands: `sudo apt update && sudo apt install -y nginx` OR `apache2`.
- Encourage choosing one stack for the live demo to reduce context switching.

## Slide 16 – Nginx Layout (Ubuntu)
- Map the directories: `nginx.conf` (global), `sites-available` (definitions), `sites-enabled` (symlinks), logs under `/var/log/nginx`.
- Command tour: `ls -la /etc/nginx/sites-available /etc/nginx/sites-enabled`.
- Mention `conf.d` exists but Ubuntu favors sites-* for vhosts.

## Slide 17 – Default Site Gotchas
- Default server block catches unmatched hosts; classic symptom: always seeing the welcome page.
- Show `grep -R "default_server" -n /etc/nginx/sites-available`.
- Quick disable: `sudo rm /etc/nginx/sites-enabled/default` then `nginx -t && systemctl reload nginx`.

## Slide 18 – First Nginx Vhost (site1 HTTP)
- Walk through each directive: `listen 80`, `server_name site1.test`, `root /var/www/site1`, `index index.html`.
- Emphasize indentation isn’t required but helps reading.
- Add log paths later for clarity.

## Slide 19 – Second Nginx Vhost (site2 HTTP)
- Nearly identical; highlight the only changes are `server_name` and `root` (and optional logs).
- Reinforce that same port 80 is fine; Host header separates them.

## Slide 20 – Enable Sites via Symlinks
- Explain why symlink: enables toggling without editing files; keeps “available” as source of truth.
- Commands: `sudo ln -s /etc/nginx/sites-available/site1.conf /etc/nginx/sites-enabled/`.
- To disable: `sudo rm /etc/nginx/sites-enabled/site1.conf` (config still exists).

## Slide 21 – Validate Before Reload
- `sudo nginx -t` prints config OK or exact file:line on error—faster than guessing.
- Anecdote: catching missing semicolon here prevents downtime; make it habit before every reload.

## Slide 22 – Reload Nginx Safely
- `systemctl reload nginx` keeps workers running while they pick up new config; restart is heavier.
- Verify with `systemctl status nginx --no-pager` right after reload.
- If reload fails, status + `journalctl -u nginx -n 50` shows why.

## Slide 23 – Test Routing with Host Headers
- Demonstrate both sites: `curl -H 'Host: site1.test' http://IP/` and site2.
- If both show same page, likely hit default server or wrong `server_name`.
- Alternative: `curl -sS -D- -o /dev/null -H 'Host: site1.test' http://IP/` to see headers only.

## Slide 24 – Bug: Missing server_name
- Symptom: all hosts land on default page; fix by adding correct `server_name` lines.
- Suggest `grep -R "server_name" -n /etc/nginx/sites-available` to audit.
- Remind to include both bare and www if needed (e.g., `server_name site1.test www.site1.test;`).

## Slide 25 – Bug: Wrong Root Permissions
- If 403/404 despite file existing, check ownership and modes.
- Commands: `namei -l /var/www/site1/index.html` to inspect path perms; `sudo chown -R www-data:www-data /var/www/site1` as quick fix.
- Explain www-data is the nginx worker user on Ubuntu.

## Slide 26 – Logs First
- Access log = requests; error log = reasons. Tail both during tests.
- Commands: `sudo tail -f /var/log/nginx/access.log` and `error.log`; Ctrl+C to stop.
- Tip: use `grep -i` inside `journalctl -u nginx` for startup issues not in file logs.

## Slide 27 – Per-Site Logs
- Add per-site `access_log` and `error_log` paths inside each server block for cleaner debugging.
- After changing, `nginx -t` then reload.
- To view: `sudo tail -f /var/log/nginx/site1.access.log` etc.

## Slide 28 – Default Server Behavior
- If no match, nginx uses first `server` marked `default_server` on a port.
- Strategy: create an intentional default that returns 444/418 or a simple “unknown host” page to spot misroutes.

## Slide 29 – Apache Layout
- Parallel to nginx: `sites-available`, `sites-enabled`, logs in `/var/log/apache2`.
- Modules live in `mods-available`/`mods-enabled` managed by `a2enmod`/`a2dismod`.
- Command tour: `ls -la /etc/apache2/{sites,mods}-{available,enabled}`.

## Slide 30 – Apache Vhost: site1 HTTP
- Explain `<VirtualHost *:80>` binding; `ServerName`, `DocumentRoot`.
- Add `<Directory>` block to allow access: `Require all granted`; warn that forgetting this yields 403.
- Optional: add CustomLog/ErrorLog per site.

## Slide 31 – Apache Vhost: site2 HTTP
- Mirror site1 with different `ServerName` and DocumentRoot.
- Mention `ServerAlias www.site2.test` pattern if desired.

## Slide 32 – Enable Apache Sites
- Workflow: `a2ensite site1.conf site2.conf` → `apachectl configtest` → `systemctl reload apache2`.
- Configtest meaning: parses configs and prints “Syntax OK” or error with file:line.
- Disable with `a2dissite site1.conf` if needed.

## Slide 33 – Vhosts vs TLS
- Clarify division: vhost decides routing; TLS secures transport and identity.
- Both must align: correct cert for the name that vhost serves.

## Slide 34 – TLS in One Sentence
- TLS encrypts traffic and proves server identity via certificate matching hostname.
- Demo `curl -vk https://example.com` to show handshake; point at `subject:` and `issuer:` lines.

## Slide 35 – Cert + Private Key
- Cert is public; key must stay secret. Server proves possession during handshake.
- If key leaks, attackers can impersonate you even with the same cert.
- Storage tip: lock down key perms (`chmod 600`, owner root).

## Slide 36 – Certificate Chain
- Leaf cert signed by intermediate; chain ends at trusted root in client store.
- Missing intermediate causes “not trusted” despite correct leaf.
- Command: `echo | openssl s_client -connect example.com:443 -servername example.com -showcerts` to view chain.

## Slide 37 – Domain Validation Methods
- ACME HTTP-01: serve token on http://DOMAIN/.well-known/acme-challenge/…; needs open port 80.
- DNS-01: add TXT record; works even if HTTP blocked but requires DNS control.
- Tell students which you’ll use (likely HTTP-01) and why.

## Slide 38 – SNI for TLS Vhosting
- Client sends hostname in TLS ClientHello (SNI) so server can pick the right cert.
- Without SNI, first cert on 443 is served—causes “wrong cert” for other hosts.
- Test with `openssl s_client -connect IP:443 -servername site1.test` vs site2.

## Slide 39 – TLS Versions
- Recommend allowing TLS 1.2 and 1.3; disable 1.0/1.1.
- Check configs: `grep -R "ssl_protocols" -n /etc/nginx` or Apache SSL config.

## Slide 40 – Let’s Encrypt Default
- Free, automated; best for public-facing names with real DNS.
- Install: `sudo apt install -y certbot python3-certbot-nginx` (or -apache).
- Mention rate limits; in labs, use `--staging` for practice.

## Slide 41 – Certbot with Nginx
- `certbot --nginx -d site1.example.com -d site2.example.com`; plugin edits configs and sets renewals.
- Flags: `--redirect` to force HTTPS automatically; `--test-cert` for staging CA during practice.

## Slide 42 – Certbot with Apache
- Similar command: `certbot --apache -d ...`; will add SSL vhost and rewrites.
- Encourage reviewing generated files to demystify changes.

## Slide 43 – What Certbot Changes
- Adds 443 server blocks, sets `ssl_certificate`/`ssl_certificate_key`, may add HTTP→HTTPS redirect block.
- Tell students to diff before/after: `sudo grep -R "ssl_certificate" -n /etc/nginx`.

## Slide 44 – Verify Renewal
- LE certs ~90 days; renewal via systemd timer/cron.
- Check timer: `systemctl list-timers | grep certbot`; run `sudo certbot renew --dry-run` to confirm.
- Anecdote: forgetting port 80 breaks HTTP-01 renewals—keep it open.

## Slide 45 – Redirect HTTP to HTTPS
- Keep 80 listening for ACME and redirects; add 301 to HTTPS once certs stable.
- Example nginx snippet: server on 80 with `return 301 https://$host$request_uri;` but exclude `/.well-known/acme-challenge/` if using manual flows.

## Slide 46 – HSTS Caution
- HSTS tells browsers “always use HTTPS for this host.” Great when stable, risky during setup because it sticks (max-age cached).
- Recommend enabling only after multiple successful days of HTTPS; start with short `max-age=300` if testing.

## Slide 47 – Self-Signed Certs (Labs/Internal)
- Useful when no public domain or offline; browsers warn but traffic is still encrypted.
- Command: `openssl req -new -newkey rsa:2048 -nodes -x509 -days 365 -keyout selfsigned.key -out selfsigned.crt -subj "/CN=site1.test"`.
- Explain warning page expectation; this is normal in labs.

## Slide 48 – Wire Self-Signed into Nginx
- In 443 server block set `ssl_certificate`/`ssl_certificate_key` to generated files.
- Keep HTTP block for redirect or parallel testing.
- Test with `curl -vk https://site1.test` to see cert details despite self-signed warning.

## Slide 49 – Troubleshooting HTTPS
- If 80 works but 443 fails: check firewall (`sudo ufw status`), listener (`ss -lnpt | grep 443`), cert paths readable, and SNI hostnames.
- Use `journalctl -u nginx -n 50` or Apache error log for startup SSL errors.

## Slide 50 – Mini-Lab Definition of Done
- Success checklist: site1/site2 route over HTTP, HTTPS serves correct content and matching cert per host, `certbot renew --dry-run` passes.
- Encourage students to validate with `curl -I -H 'Host: site1.test' https://IP/` and `openssl s_client -servername site2.test -connect IP:443`.

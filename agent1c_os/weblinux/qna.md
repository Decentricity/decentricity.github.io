# Q&A (Slides: 1,2,3,4,5,6,7,8,9,10,13,14,16,18,20,21,22,23,34,41)

Each question maps to the slide number in the trimmed deck. Multiple choice; answer key at bottom.

1) (Slide 1) What’s the promised outcome of this session?  
   A) Build a Kubernetes cluster  
   B) Host two sites on one Ubuntu server and add HTTPS  
   C) Write a web framework  
   D) Configure a mail server

2) (Slide 2) Why use Multipass for the lab?  
   A) It provides Windows VMs by default  
   B) Identical, disposable Ubuntu VMs for every student  
   C) It’s the only way to run Docker  
   D) It disables networking to be safer

3) (Slide 3) In `multipass launch --name web --cpus 2 --mem 2G --disk 10G 22.04`, what does `--disk 10G` mean?  
   A) Preallocates 10G immediately  
   B) Sets a sparse virtual disk up to 10G  
   C) Limits RAM to 10G  
   D) Reserves 10G of host swap

4) (Slide 4) What does `multipass exec web -- sudo apt update` do?  
   A) Runs on the host machine  
   B) Opens an interactive shell  
   C) Runs `sudo apt update` inside the VM named `web`  
   D) Updates Multipass itself

5) (Slide 5) Why add entries to `/etc/hosts` during testing?  
   A) To block ads  
   B) To override DNS locally so Host header matches lab domains  
   C) To speed up the VM  
   D) To enable IPv6

6) (Slide 6) What mainly decides which site responds on one server?  
   A) The MAC address  
   B) The Host header in the HTTP request  
   C) The CPU model  
   D) The default gateway

7) (Slide 7) Why are ports 80/443 “special”?  
   A) They are UDP-only  
   B) Browsers default to them; binding <1024 usually requires root/capability  
   C) They’re blocked by firewalls by default  
   D) They only work on IPv6

8) (Slide 8) What does the Host header contain?  
   A) Client IP  
   B) Server OS version  
   C) Domain name the client is requesting  
   D) TLS cipher

9) (Slide 9) Which curl command tests vhost routing without DNS?  
   A) `curl http://IP/`  
   B) `curl -H 'Host: site1.test' http://IP/`  
   C) `curl https://IP/`  
   D) `curl -k http://site1.test/`

10) (Slide 10) Name-based virtual hosting lets you…  
    A) Serve many domains on one IP using Host header  
    B) Serve one domain per IP only  
    C) Require multiple NICs  
    D) Avoid using DNS entirely

11) (Slide 13) Why keep separate web roots like `/var/www/site1` and `/var/www/site2`?  
    A) They speed up the kernel  
    B) Clear ownership, permissions, and logging per site  
    C) Required by nginx license  
    D) Needed only for HTTPS

12) (Slide 14) Why make each site’s HTML visibly different?  
    A) Aesthetic reasons only  
    B) Helps verify routing is correct when testing Host headers  
    C) Needed for TLS handshakes  
    D) Required by systemd

13) (Slide 16) What is the purpose of `sites-enabled` in nginx?  
    A) Stores log files  
    B) Holds live configs via symlinks from `sites-available`  
    C) Contains SSL keys  
    D) Temporary directory for cache

14) (Slide 18) Which directive routes requests to the right nginx server block?  
    A) `root`  
    B) `listen`  
    C) `server_name`  
    D) `index`

15) (Slide 20) Why enable a site with a symlink instead of editing `nginx.conf` directly?  
    A) It increases performance  
    B) It allows reversible enables/disables without touching main config  
    C) It is required for TLS  
    D) It avoids using systemd

16) (Slide 21) What should you always run before reloading nginx?  
    A) `systemctl restart nginx`  
    B) `nginx -t`  
    C) `apt upgrade`  
    D) `curl -I http://localhost/`

17) (Slide 22) Why prefer `systemctl reload nginx` over `restart`?  
    A) Reload recompiles nginx  
    B) Reload keeps connections alive while applying config  
    C) Restart is faster  
    D) Reload clears logs

18) (Slide 23) If both site1 and site2 return the same page, what’s the likely issue?  
    A) Disk is full  
    B) Wrong or missing `server_name` so default server is used  
    C) CPU is overloaded  
    D) RAM is low

19) (Slide 34) What are the two core promises of TLS?  
    A) Compression and caching  
    B) Encryption of traffic and identity verification of server  
    C) Faster DNS and cheaper hosting  
    D) Malware scanning

20) (Slide 41) What does `certbot --nginx -d site1.example.com -d site2.example.com` do?  
    A) Generates self-signed certs only  
    B) Requests/installs Let’s Encrypt certs and edits nginx to use them  
    C) Disables HTTP on port 80  
    D) Upgrades nginx to latest mainline

---

Answer Key (with brief why):  
1 B – goal is two sites + HTTPS, not Kubernetes.  
2 B – Multipass gives identical, disposable Ubuntu VMs.  
3 B – sets a sparse virtual disk up to 10G.  
4 C – runs that command inside the VM named web.  
5 B – hosts file overrides DNS so Host header matches lab domains.  
6 B – Host header drives vhost selection.  
7 B – default browser ports and binding <1024 needs root/capability.  
8 C – Host header carries the requested domain name.  
9 B – adds Host header to test vhost routing without DNS.  
10 A – many domains on one IP via Host header.  
11 B – separate roots keep ownership/perms/logs clean per site.  
12 B – different pages prove routing is working.  
13 B – sites-enabled holds live configs via symlinks.  
14 C – server_name decides which server block matches.  
15 B – symlink enables/disables cleanly without editing main config.  
16 B – nginx -t catches syntax errors before reload.  
17 B – reload applies config without dropping connections.  
18 B – default server hit due to missing/wrong server_name.  
19 B – TLS gives encryption plus server identity verification.  
20 B – certbot requests/installs LE certs and rewrites nginx for them.

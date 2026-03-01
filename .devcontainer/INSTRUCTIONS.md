# Remote Development Setup — Step by Step

This guide walks you through moving Sentinel Suite development off your home
computer and onto a cloud VM. Follow each step in order.

---

## What You're Setting Up

A cloud server that runs all your dev tools (Docker, Node, databases, etc.)
so your home machine stays clean. You'll connect to it over SSH from any
device — laptop, iPad, whatever.

**Cost:** ~$16-32/month depending on the plan you pick.

---

## Step 1: Generate an SSH Key (on your local machine)

Open a terminal on your laptop/desktop and run:

```bash
bash scripts/remote/setup-ssh.sh SKIP
```

This will fail the connection test (no VM yet), but it creates your SSH key at
`~/.ssh/sentinel_ed25519`. Copy the public key it prints — you'll need it in
Step 3.

Or generate one manually:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sentinel_ed25519 -C "sentinel-dev" -N ""
cat ~/.ssh/sentinel_ed25519.pub
```

Copy that entire output (starts with `ssh-ed25519`). You'll paste it into the
cloud provider in Step 3.

---

## Step 2: Pick a Cloud Provider and Create an Account

### Option A: Hetzner (Recommended — cheapest, great performance)

1. Go to https://www.hetzner.com/cloud
2. Click "Register" and create an account
3. You'll need to verify your identity (credit card or PayPal)
4. Once verified, you land on the Cloud Console dashboard

### Option B: DigitalOcean (More US-centric, slightly pricier)

1. Go to https://www.digitalocean.com
2. Click "Sign Up" — you can use GitHub to sign in
3. Add a payment method
4. You land on the dashboard

### Option C: Vultr (Good middle ground)

1. Go to https://www.vultr.com
2. Click "Sign Up" and create an account
3. Add a payment method
4. You land on the dashboard

---

## Step 3: Create Your Server

### If using Hetzner:

1. In the Cloud Console, click **"Add Server"**
2. **Location:** Pick the one closest to you
   - US East Coast → Ashburn, VA
   - US West Coast → Hillsboro, OR
   - Europe → Falkenstein or Nuremberg
3. **Image:** Ubuntu 24.04
4. **Type:** Shared vCPU — x86
   - **CX31** ($7.50/mo) — 4 vCPU, 8GB RAM — good for core dev (Postgres + Redis only)
   - **CX41** ($14.50/mo) — 8 vCPU, 16GB RAM — needed for full stack with observability
   - **CPX31** ($11.50/mo) — 4 AMD vCPU, 8GB RAM — good balance
5. **SSH Keys:** Click "Add SSH Key", paste the public key from Step 1
6. **Cloud config / User data:** Check "Cloud config", then paste the entire
   contents of `scripts/remote/cloud-init.yml`
   - **IMPORTANT:** First edit `cloud-init.yml` and replace:
     - `<PASTE_YOUR_SSH_PUBLIC_KEY_HERE>` with your public key from Step 1
     - `<YOUR_REPO_URL>` with your GitHub repo SSH URL
       (e.g. `git@github.com:Sentinel-Suite/sentinel.git`)
7. **Name:** `sentinel-dev`
8. Click **"Create & Buy Now"**
9. Wait ~2-3 minutes for it to boot and run the setup script
10. **Copy the IP address** shown on the server detail page

### If using DigitalOcean:

1. Click **"Create" → "Droplets"**
2. **Region:** Pick the closest one (e.g. NYC1 for US East)
3. **Image:** Ubuntu 24.04 (LTS) x64
4. **Size → Premium CPU:**
   - **$24/mo** — 4 vCPU, 8GB RAM, 160GB NVMe (equivalent to Hetzner CX31)
   - **$48/mo** — 8 vCPU, 16GB RAM, 320GB NVMe (equivalent to Hetzner CX41)
5. **Authentication:** Click "SSH Keys" → "Add SSH Key", paste your public key
6. **Advanced Options → User Data:** Check the box, paste contents of
   `scripts/remote/cloud-init.yml` (with your edits from above)
7. **Hostname:** `sentinel-dev`
8. Click **"Create Droplet"**
9. Wait ~2-3 minutes, then **copy the IP address**

### If using Vultr:

1. Click **"Deploy New Server"**
2. **Type:** Cloud Compute — Shared CPU
3. **Location:** Closest to you
4. **Image:** Ubuntu 24.04 LTS x64
5. **Plan:**
   - **$24/mo** — 4 vCPU, 8GB RAM (comparable to Hetzner CX31)
   - **$48/mo** — 8 vCPU, 16GB RAM (comparable to Hetzner CX41)
6. **SSH Keys:** Add your public key
7. **User Data:** Paste your edited `cloud-init.yml`
8. **Hostname:** `sentinel-dev`
9. Click **"Deploy Now"**
10. Wait ~2-3 minutes, **copy the IP address**

---

## Step 4: Connect SSH to Your Server

Back on your local machine, run:

```bash
bash scripts/remote/setup-ssh.sh dev.sentinel-suite.app
```

This uses your domain name so you never have to remember the IP. You can also
pass a raw IP if you prefer (`bash scripts/remote/setup-ssh.sh 65.108.42.123`).

**But first** — point `dev.sentinel-suite.app` to your VM. Go to your domain
registrar and add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | `dev.sentinel-suite.app` | `<YOUR_VM_IP>` |
| A | `*.dev.sentinel-suite.app` | `<YOUR_VM_IP>` |

The first record lets you `ssh dev.sentinel-suite.app`. The wildcard lets
subdomains like `admin.dev.sentinel-suite.app` work later (Step 8).

This adds the server to your SSH config. If it prints "Connected successfully!"
you're good. If not, wait another minute and try:

```bash
ssh sentinel-dev
```

**Troubleshooting if connection fails:**
- Wait 3-5 minutes — cloud-init may still be running
- Double-check the IP/hostname
- Make sure your DNS record is pointing to the right IP
- Make sure your public key was pasted correctly in Step 3

---

## Step 5: Verify the Server Setup

Once connected via SSH, check everything installed correctly:

```bash
# Should print Docker version
docker --version

# Should print Node 22.x
node --version

# Should print pnpm 9.x
pnpm --version

# Should print claude version
claude --version

# Should show the cloned repo
ls ~/sentinel-suite
```

If `claude --version` fails, install it manually:

```bash
npm install -g @anthropic-ai/claude-code
```

If `ls ~/sentinel-suite` is empty or missing, clone manually:

```bash
git clone git@github.com:Sentinel-Suite/sentinel.git ~/sentinel-suite
```

---

## Step 6: Start Developing

### Using Claude Code (primary workflow):

```bash
ssh sentinel-dev
cd ~/sentinel-suite
tmux new -s dev          # persistent session (survives disconnects)
make up                  # start Postgres + Redis
pnpm install             # install dependencies (first time only)
pnpm dev                 # start all apps
```

Open a new tmux pane (`Ctrl+B` then `%`) and run Claude:

```bash
claude
```

If your SSH drops, reconnect and resume:

```bash
ssh sentinel-dev
tmux attach -t dev       # everything is still running
```

Or use the shortcut script:

```bash
bash scripts/remote/connect.sh
```

### Using VS Code or Cursor:

1. Install the **Remote - SSH** extension
2. Press `Cmd+Shift+P` → "Remote-SSH: Connect to Host"
3. Select `sentinel-dev`
4. VS Code opens on the remote server
5. Open the `~/sentinel-suite` folder
6. VS Code will detect `.devcontainer/` and offer "Reopen in Container" — click it
7. Full dev environment is ready

### Using iPad (Blink Shell or Termius):

1. Install Blink Shell ($20) or Termius (free tier) from the App Store
2. Add a new host:
   - Hostname: `dev.sentinel-suite.app` (or VM IP)
   - User: `dev`
   - Key: import your `sentinel_ed25519` private key
3. Connect, then: `tmux attach -t dev`

---

## Step 7: Accessing Web UIs (Grafana, pgAdmin, etc.)

Your SSH config already forwards the app ports (3500-3502). To access
infrastructure UIs, uncomment the lines in `~/.ssh/config` under
`Host sentinel-dev`:

```
LocalForward 3530 localhost:3530   # Grafana
LocalForward 3533 localhost:3533   # Jaeger
LocalForward 3526 localhost:3526   # Mailpit
LocalForward 3550 localhost:3550   # pgAdmin
```

Then reconnect (`ssh sentinel-dev`) and open `http://localhost:3530` in your
browser for Grafana, etc.

**Alternative — Tailscale (free, better for iPad):**

1. Sign up at https://tailscale.com (free for personal use)
2. Install Tailscale on your VM: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
3. Install Tailscale on your devices
4. Access services directly: `http://<tailscale-ip>:3530`
5. No SSH tunnels needed

---

## Daily Workflow Cheat Sheet

```bash
# Connect (from any device)
ssh sentinel-dev

# Resume your session
tmux attach -t dev

# Start infrastructure + apps (if not already running)
make up && pnpm dev

# Start Claude Code
claude

# Full stack with observability
make up-full && pnpm dev

# Stop everything
make down

# Check what's running
make ps
```

---

## Step 8: Custom Subdomains with HTTPS (Optional)

Access your apps at real URLs like `admin.dev.sentinel-suite.app` instead of
`localhost:3502`. Uses Let's Encrypt for free HTTPS certificates.

### 8a. DNS

If you already set up the `dev.sentinel-suite.app` and `*.dev.sentinel-suite.app`
A records in Step 4, you're done with DNS. If not, go back and add them now.

**If using Cloudflare:** Set the proxy status to "DNS only" (grey cloud),
not "Proxied" — otherwise Cloudflare's proxy conflicts with Traefik's
Let's Encrypt HTTP challenge.

### 8b. Open Ports 80 + 443 on the VM

SSH into the VM and run:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 8c. Add to .env

Add these to your `.env` on the VM:

```bash
DEV_DOMAIN=dev.sentinel-suite.app
ACME_EMAIL=your-email@example.com
```

### 8d. Start with Subdomains

```bash
cd ~/sentinel-suite
docker compose \
  -f docker/docker-compose.yml \
  -f .devcontainer/docker-compose.remote.yml \
  --profile full --profile remote \
  up -d
```

### 8e. Access Your Apps

| URL | Service |
|-----|---------|
| `https://api.dev.sentinel-suite.app` | NestJS API |
| `https://web.dev.sentinel-suite.app` | Next.js web app |
| `https://admin.dev.sentinel-suite.app` | Admin dashboard |
| `https://grafana.dev.sentinel-suite.app` | Grafana dashboards |
| `https://jaeger.dev.sentinel-suite.app` | Jaeger tracing |
| `https://mail.dev.sentinel-suite.app` | Mailpit email UI |
| `https://pgadmin.dev.sentinel-suite.app` | pgAdmin |
| `https://traefik.dev.sentinel-suite.app` | Traefik dashboard |

First request takes ~10 seconds while Let's Encrypt issues the certificate.

**Important:** These are publicly accessible dev URLs. Do not put real
credentials or sensitive data in this environment. Consider adding Traefik
BasicAuth middleware if you want password protection (see Traefik docs).

---

## Shutting Down / Saving Money

Your VM charges by the hour even when idle. Options:

- **Power off** when not coding (Hetzner: still charges for disk/IP, but much
  less). In Hetzner Console → Server → Power → Off.
- **Snapshot + Delete** for longer breaks. Create a snapshot ($0.01/GB/mo),
  delete the server, restore from snapshot when ready.
- **Keep it running** if the $16-32/mo is fine — it's always ready to go.

---

## File Reference

| File | Purpose |
|------|---------|
| `.devcontainer/devcontainer.json` | Devcontainer config for VS Code/Cursor |
| `.devcontainer/postCreate.sh` | Auto-setup script that runs inside the container |
| `.devcontainer/.env.devcontainer` | Environment overrides for Docker networking |
| `scripts/remote/cloud-init.yml` | VM auto-provisioning (edit before use) |
| `scripts/remote/setup-ssh.sh` | Local SSH config helper |
| `scripts/remote/connect.sh` | Quick connect with tmux |
| `.devcontainer/docker-compose.remote.yml` | Compose override for subdomain routing |
| `.devcontainer/traefik/traefik-remote.yml` | Traefik config with HTTPS + Let's Encrypt |

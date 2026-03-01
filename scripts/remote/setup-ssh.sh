#!/usr/bin/env bash
set -euo pipefail

# Sentinel Suite — SSH configuration helper
# Run this on your LOCAL machine to set up SSH access to your dev VM.
# Usage: bash scripts/remote/setup-ssh.sh <VM_IP_ADDRESS>

VM_IP="${1:?Usage: setup-ssh.sh <VM_IP_ADDRESS>}"
KEY_NAME="sentinel_ed25519"
KEY_PATH="$HOME/.ssh/$KEY_NAME"
SSH_CONFIG="$HOME/.ssh/config"

echo "==> Setting up SSH for Sentinel Suite dev VM at $VM_IP"

# Generate SSH key if it doesn't exist
if [ ! -f "$KEY_PATH" ]; then
  echo "==> Generating SSH key at $KEY_PATH"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -C "sentinel-dev" -N ""
  echo ""
  echo "!! Copy this public key to your cloud-init.yml or VM:"
  echo ""
  cat "${KEY_PATH}.pub"
  echo ""
fi

# Add SSH config entry
if ! grep -q "Host sentinel-dev" "$SSH_CONFIG" 2>/dev/null; then
  echo "==> Adding sentinel-dev entry to $SSH_CONFIG"
  cat >> "$SSH_CONFIG" <<EOF

# Sentinel Suite dev VM
Host sentinel-dev
    HostName $VM_IP
    User dev
    IdentityFile $KEY_PATH
    ForwardAgent yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
    # App ports
    LocalForward 3500 localhost:3500
    LocalForward 3501 localhost:3501
    LocalForward 3502 localhost:3502
    # Infrastructure ports (uncomment as needed)
    # LocalForward 3510 localhost:3510
    # LocalForward 3530 localhost:3530
    # LocalForward 3533 localhost:3533
    # LocalForward 3540 localhost:3540
    # LocalForward 3526 localhost:3526
    # LocalForward 3550 localhost:3550
EOF
  echo "==> Done! Connect with: ssh sentinel-dev"
else
  echo "==> sentinel-dev already exists in $SSH_CONFIG — skipping"
fi

# Test connection
echo ""
echo "==> Testing connection..."
ssh -o ConnectTimeout=5 sentinel-dev "echo 'Connected successfully!'" 2>/dev/null || echo "!! Connection failed — make sure the VM is running and your key is authorized"

# Deploying PrayogCode C Compiler on Google Cloud

This guide walks you through deploying the complete PrayogCode C Compiler application (Frontend, Backend, and Hardened Docker execution sandbox) to **Google Cloud Compute Engine (GCE)**.

---

## 1. Why Compute Engine (GCE)?
PrayogCode compiles and executes untrusted C code inside ephemeral, hardened Docker containers using `docker run` flags (`--network none`, `--cap-drop ALL`, `--memory 128m`, `--pids-limit 64`, `--tmpfs`, etc.).
Google Cloud Run (Serverless) uses gVisor sandboxing and **does not support running a Docker daemon or launching nested Docker sibling containers**. A Compute Engine VM provides full Docker support with native Linux kernel cgroup isolation.

---

## 2. Create the GCE VM Instance

### Option A: Using Google Cloud Web Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/) > **Compute Engine** > **VM instances**.
2. Click **Create Instance**:
   - **Name**: `prayogcode-vm`
   - **Region / Zone**: Choose a region near you (e.g., `asia-south1-a` for India or `us-central1-a` for US).
   - **Machine type**: `e2-small` (2 vCPU, 2 GB RAM — cost-effective and handles concurrent sandboxes well) or `e2-medium`.
   - **Boot disk**: Click **Change** > Select **Ubuntu 24.04 LTS (x86/64)** with **25 GB** Standard persistent disk.
   - **Firewall**: Check **Allow HTTP traffic** and **Allow HTTPS traffic**.
3. Under **Advanced options** > **Networking** > **Network interfaces**:
   - Under **External IPv4 address**, select **Create IP address** to assign a **Static External IP** (this prevents the IP from changing when rebooting).
4. Click **Create**.

### Option B: Using `gcloud` CLI
```bash
gcloud compute instances create prayogcode-vm \
    --project="<YOUR_PROJECT_ID>" \
    --zone="us-central1-a" \
    --machine-type="e2-small" \
    --image-family="ubuntu-2404-lts-amd64" \
    --image-project="ubuntu-os-cloud" \
    --boot-disk-size="25GB" \
    --tags="http-server,https-server"
```

---

## 3. Run the Automated Setup

1. Open the SSH console on your VM (via the Google Cloud Console "SSH" button, or using `gcloud compute ssh prayogcode-vm`).
2. Clone your repository:
   ```bash
   git clone <YOUR_REPOSITORY_URL> /var/www/prayogcode
   ```
   *(Or copy the files to `/var/www/prayogcode`)*

3. Make the setup script executable and run it:
   ```bash
   chmod +x /var/www/prayogcode/deploy/setup.sh
   /var/www/prayogcode/deploy/setup.sh
   ```

The script will automatically:
- Install system dependencies, Docker, Node.js 20, and Nginx
- Build the `prayogcode-c-runner` Docker image
- Install npm dependencies and build the React frontend
- Register and start the `prayogcode-backend` systemd service
- Configure Nginx with WebSocket (`/ws`) reverse-proxy and start serving the site

---

## 4. Configure Domain & Free SSL

1. **DNS Setup**:
   - Go to your DNS provider (e.g. `is-a.dev` or registrar).
   - Create an **A Record** pointing `prayogcode.is-a.dev` to your VM's **Static External IP**.

2. **Obtain SSL Certificate (HTTPS / WSS)**:
   Once the DNS record resolves, run:
   ```bash
   sudo certbot --nginx -d prayogcode.is-a.dev
   ```
   Certbot will automatically install the certificate, enable HTTPS, and configure automatic certificate renewal.

---

## 5. Maintenance & Logs

- **Check backend service status**:
  ```bash
  sudo systemctl status prayogcode-backend
  ```
- **Live backend logs**:
  ```bash
  journalctl -u prayogcode-backend -f
  ```
- **Restart backend**:
  ```bash
  sudo systemctl restart prayogcode-backend
  ```
- **Check Docker runner image**:
  ```bash
  docker images | grep prayogcode
  ```

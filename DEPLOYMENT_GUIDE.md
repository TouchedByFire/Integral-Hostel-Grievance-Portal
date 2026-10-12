# Hosting & Deployment Guide :: IntegraCare Portal

This guide provides step-by-step instructions for deploying the **IntegraCare Hostel Grievance Portal** to production.

---

## Architecture Summary
- **Backend**: Node.js (Express 5)
- **Database**: MySQL 8.0 (`hostel_grievance_db`)
- **Real-Time Sync**: Server-Sent Events (SSE) (requires long-lived persistent connections, standard in Node.js server environments)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (served directly by Express from `/public`)

---

## Option 1: Railway.app (Recommended — Fastest & Easiest, ~5 Minutes)

Railway is the simplest platform because it provides both a **Node.js Web Service** and a **MySQL Database** inside the same project with zero server management.

### Steps:
1. **Push your code to GitHub**:
   - Create a GitHub repository (e.g. `hostel-portal`).
   - Push your project files to the `main` branch.

2. **Create Project on Railway**:
   - Go to [Railway.app](https://railway.app) and sign in with GitHub.
   - Click **New Project** $\rightarrow$ **Provision MySQL**.
   - Railway will launch a live MySQL 8.0 instance and create variables (`MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLPORT`, `MYSQLDATABASE`).

3. **Deploy the Node.js Service**:
   - In the same Railway project, click **New** $\rightarrow$ **GitHub Repo**.
   - Select your repository (`hostel-portal`).
   - In the Node service **Variables** tab, click **Add Reference** to link the MySQL variables from your database service.
   - Railway will automatically run `npm install` and `npm start`.

4. **Generate Public Domain**:
   - In the Node service **Settings** tab $\rightarrow$ **Networking** $\rightarrow$ Click **Generate Domain**.
   - You will get a live secure URL: `https://your-app-production.up.railway.app`.

---

## Option 2: Render.com + Free Cloud MySQL (Aiven / TiDB)

Render provides free Node.js hosting, paired with a free cloud MySQL database.

### Step 1: Create Free MySQL Database
- Go to [Aiven.io](https://aiven.io) or [TiDB Cloud](https://tidbcloud.com) and create a free MySQL database service.
- Copy your connection details:
  - Host
  - Port
  - User
  - Password
  - Database Name (`hostel_grievance_db`)

### Step 2: Deploy Web Service on Render
1. Go to [Render.com](https://render.com) and sign in.
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `DB_HOST`: `<your-mysql-host>`
   - `DB_PORT`: `<your-mysql-port>`
   - `DB_USER`: `<your-mysql-user>`
   - `DB_PASSWORD`: `<your-mysql-password>`
   - `DB_NAME`: `hostel_grievance_db`
6. Click **Deploy Web Service**. Render will provision your URL: `https://your-app.onrender.com`.

---

## Option 3: Dedicated Linux VPS (DigitalOcean, AWS EC2, Linode, Hetzner)

Best for institutional deployments with a custom domain (e.g. `hostelcare.iul.ac.in`).

### 1. Provision Ubuntu 22.04 / 24.04 Server
Connect via SSH:
```bash
ssh root@your-server-ip
```

### 2. Install Node.js, MySQL, Nginx, and Git
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx mysql-server

# Verify installations
node -v
npm -v
mysql --version
```

### 3. Configure MySQL Database
```bash
sudo mysql
```
Inside the MySQL prompt:
```sql
CREATE DATABASE hostel_grievance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hostel_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON hostel_grievance_db.* TO 'hostel_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Clone and Setup the Application
```bash
cd /var/www
git clone https://github.com/your-username/hostel-portal.git
cd hostel-portal

# Install dependencies
npm install

# Create environment file
cat << 'EOF' > .env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=hostel_user
DB_PASSWORD=StrongPassword123!
DB_NAME=hostel_grievance_db
EOF
```

### 5. Run with PM2 (Process Daemon)
PM2 ensures the server restarts automatically if the server reboots or crashes:
```bash
sudo npm install -g pm2
pm2 start server.js --name "hostel-portal"
pm2 save
pm2 startup
```

### 6. Configure Nginx Reverse Proxy
Create an Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/hostel-portal
```
Paste the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com; # or your server IP

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # Essential for SSE (Server-Sent Events) live sync:
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hostel-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Install Free SSL Certificate (HTTPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Option 4: University Campus LAN / On-Premise Server

If hosting inside the university network:
1. Ensure the server PC is assigned a **static local IP** (e.g. `192.168.1.100`).
2. Run MySQL Server and Node.js on that machine.
3. Open inbound port `3001` (or port `80` if using Nginx) in Windows Defender Firewall / Linux UFW.
4. Students and staff connected to Campus Wi-Fi can open:
   👉 `http://192.168.1.100:3001`

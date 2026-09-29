# 🛠️ Developer Utilities

This directory contains convenience tools, launch scripts, performance benchmarks, and distribution packages that support the **Dnyanshree Proctored Exam System**.

---

## 📂 Directory Structure

```
developer-utilities/
├── run_project.bat         # 🚀 1-Click Launch: Starts Backend + Dashboard + ADB
├── deploy.bat              # 🌐 1-Click Deploy: Stages, commits, and pushes to Render & Hostinger
├── apks/                   # 📱 Android APKs ready for distribution
│   ├── Dnyanshree_Exam_App.apk  # Latest release APK with Device Admin fixes
│   └── exam.apk                 # Baseline reference APK
├── docs/                   # 📄 Project documentation & audit reports
│   ├── mock_observations.md     # Mock exam findings & solutions
│   └── system_documentation.md  # Comprehensive system architecture & data dictionary
├── load-testing/           # ⚡ Load testing & Concurrency engines
│   ├── simulate_load.js         # Automated multi-student load simulator
│   ├── exam_load_test.js        # Grafana k6 performance testing scenario
│   ├── prepare_k6_users.js      # Token generator for 100 k6 virtual users
│   └── cleanup_k6_users.js      # Database cleanup script post-test
└── scripts/                # 🧹 Database administration tools
    └── clear_users.js           # User wipe utility for staging
```

---

## 🚀 Common Tasks

### 1. Launching Local Development Environment
Double-click `run_project.bat` or run:
```powershell
.\developer-utilities\run_project.bat
```
This automatically:
- Starts the Express Backend API on `http://localhost:5000`
- Starts the Vite Teacher Dashboard on `http://localhost:5173`
- Establishes ADB reverse port-forwarding (`tcp:5000`) for connected Android phones

---

### 2. Deploying Updates to Production
Double-click `deploy.bat` or run:
```powershell
.\developer-utilities\deploy.bat
```
Prompts for a commit message and pushes to `origin main`, triggering:
- Auto-deploy of Backend on **Render**
- Auto-deploy of Dashboard on **Hostinger** via GitHub Actions FTP

---

### 3. Running 100-Student Load Simulations

#### Option A: Built-in Node Simulator
```powershell
# Simulate 100 students on the live Render Cloud
node developer-utilities/load-testing/simulate_load.js --students=100 --target=live --duration=30

# Simulate 100 students locally
node developer-utilities/load-testing/simulate_load.js --students=100 --target=local --duration=30
```

#### Option B: Grafana k6
```powershell
# Step 1: Pre-generate tokens
node developer-utilities/load-testing/prepare_k6_users.js 100

# Step 2: Run k6 load test
k6 run developer-utilities/load-testing/exam_load_test.js

# Step 3: Clean up database
node developer-utilities/load-testing/cleanup_k6_users.js
```

@echo off
echo ======================================================
echo 🚀 1. Dang keo code moi nhat tu GitHub...
echo ======================================================
git fetch --all
git reset --hard origin/main

echo ======================================================
echo 📦 2. Dang cap nhat thu vien (npm install)...
echo ======================================================
call npm install

echo ======================================================
echo 🛠️ 3. Dang build lai Frontend React (Vite)...
echo ======================================================
call npm run build

echo ======================================================
echo 🔄 4. Dang khoi dong lai Backend Server PM2...
echo ======================================================
call npx pm2 restart locket-gold --update-env || call npx pm2 start server/index.cjs --name "locket-gold"
call npx pm2 save

echo ======================================================
echo ✅ HOAN TAT CAP NHAT WEBSITE LOCKET GOLD 24/7!
echo ======================================================
pause

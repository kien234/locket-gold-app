@echo off
echo ========================================================
echo   Push Code Locket Gold App to GitHub (kien234/locket-gold-app)
echo ========================================================
echo.

set "GIT_CMD="
where git >nul 2>nul
if %errorlevel% equ 0 (
    set "GIT_CMD=git"
) else if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
) else if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Users\%USERNAME%\AppData\Local\Programs\Git\cmd\git.exe"
) else (
    echo [ERROR] Git is not installed yet on your system.
    echo Please download and install Git from: https://git-scm.com/download/win
    echo After installing Git, run push_to_github.bat again!
    pause
    exit /b
)

if not exist ".git" (
    echo [1/4] Initializing Git Repository...
    "%GIT_CMD%" init
)

echo [2/4] Adding source files...
"%GIT_CMD%" add .

echo [3/4] Creating Commit...
"%GIT_CMD%" commit -m "Feat: Complete Locket Gold CTV API Enterprise Standard"

echo [4/4] Setting Remote & Pushing to GitHub...
"%GIT_CMD%" branch -M main
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin https://github.com/kien234/locket-gold-app.git
"%GIT_CMD%" push -u origin main

echo.
echo ========================================================
echo   SUCCESSFULLY PUSHED TO GITHUB!
echo   Repository: https://github.com/kien234/locket-gold-app
echo ========================================================
pause

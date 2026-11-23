@echo off
setlocal EnableExtensions

echo ==================================================
echo   GitHub Authentication Setup ^(PAT / OAuth / SSH^)
echo ==================================================
echo.

cd /d "%~dp0"
set "TARGET_HTTPS=https://github.com/jamesldswang/Project-schedule-adjustment-app.git"
set "TARGET_SSH=git@github.com:jamesldswang/Project-schedule-adjustment-app.git"
set "USER_EMAIL=james.wang@nadisystem.com.tw"

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed. Please install Git for Windows first:
    echo         https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Choose authentication method for GitHub:
echo   [1] HTTPS + GitHub Browser Login ^(Auto-issues OAuth/PAT token via GCM or gh CLI^) [Recommended]
echo   [2] SSH Key ^(Auto-generate Ed25519 key, copy public key, open GitHub SSH settings^)
echo   [3] Enter an existing GitHub Personal Access Token ^(PAT^) manually
echo.
set /p "AUTH_CHOICE=Select 1, 2, or 3 [default=1]: "
if not defined AUTH_CHOICE set "AUTH_CHOICE=1"

if "%AUTH_CHOICE%"=="2" goto :setup_ssh
if "%AUTH_CHOICE%"=="3" goto :setup_pat

:setup_https_oauth
echo.
echo [HTTPS] Configuring Git Credential Manager ^(Windows^)...
git config --global credential.helper manager
git remote set-url origin "%TARGET_HTTPS%" >nul 2>&1

where gh >nul 2>&1
if not errorlevel 1 (
    echo [HTTPS] GitHub CLI ^(gh^) detected. Checking login status...
    gh auth status >nul 2>&1
    if errorlevel 1 (
        echo [HTTPS] Opening GitHub browser login to issue token...
        gh auth login --hostname github.com --git-protocol https --web
        if errorlevel 1 goto :auth_fail
    )
    gh auth setup-git
    echo [OK] GitHub CLI authentication configured!
    goto :auth_done
)

echo [OK] Git Credential Manager enabled.
echo      When git push runs, a GitHub login popup will open in your browser
echo      and automatically store the credential in Windows Credential Manager.
goto :auth_done

:setup_ssh
echo.
set "SSH_DIR=%USERPROFILE%\.ssh"
set "KEY_PATH=%SSH_DIR%\id_ed25519"
set "PUB_PATH=%KEY_PATH%.pub"

if not exist "%SSH_DIR%" mkdir "%SSH_DIR%"

if exist "%KEY_PATH%" (
    echo [SSH] Existing key found at %KEY_PATH%
) else (
    echo [SSH] Generating new Ed25519 SSH key for %USER_EMAIL% ...
    ssh-keygen -t ed25519 -C "%USER_EMAIL%" -f "%KEY_PATH%" -N ""
    if errorlevel 1 goto :auth_fail
)

type "%PUB_PATH%" | clip
echo.
echo [OK] Your public SSH key has been copied to the Windows clipboard!
echo --------------------------------------------------
type "%PUB_PATH%"
echo --------------------------------------------------
echo.
echo Opening https://github.com/settings/ssh/new in your browser...
echo Paste ^(Ctrl+V^) the key and click "Add SSH key".
start "" "https://github.com/settings/ssh/new"

if exist ".git" (
    git remote set-url origin "%TARGET_SSH%" >nul 2>&1
    if errorlevel 1 git remote add origin "%TARGET_SSH%" >nul 2>&1
    echo [OK] Remote 'origin' switched to SSH: %TARGET_SSH%
)
goto :auth_done

:setup_pat
echo.
echo Opening https://github.com/settings/tokens/new in your browser...
echo Select scope: [repo] and [workflow], then generate and copy your token.
start "" "https://github.com/settings/tokens/new?scopes=repo,workflow&description=Project-schedule-adjustment-app"
echo.
set /p "GH_USER=GitHub Username [default=jamesldswang]: "
if not defined GH_USER set "GH_USER=jamesldswang"
set /p "GH_PAT=Paste your GitHub PAT (ghp_...): "
if not defined GH_PAT goto :auth_fail

git config --global credential.helper manager
echo protocol=https> "%TEMP%\gh_cred_tmp.txt"
echo host=github.com>> "%TEMP%\gh_cred_tmp.txt"
echo username=%GH_USER%>> "%TEMP%\gh_cred_tmp.txt"
echo password=%GH_PAT%>> "%TEMP%\gh_cred_tmp.txt"
git credential approve < "%TEMP%\gh_cred_tmp.txt"
del /f /q "%TEMP%\gh_cred_tmp.txt" >nul 2>&1

if exist ".git" (
    git remote set-url origin "%TARGET_HTTPS%" >nul 2>&1
)
echo [OK] PAT stored securely in Windows Git Credential Manager!

:auth_done
echo.
echo Authentication setup complete.
if "%~1"=="--no-pause" exit /b 0
pause
exit /b 0

:auth_fail
echo.
echo [FAILED] GitHub authentication setup did not complete.
if "%~1"=="--no-pause" exit /b 1
pause
exit /b 1

@echo off
setlocal EnableExtensions

echo ==================================================
echo   Project-schedule-adjustment-app - Launcher ^& GitHub Release
echo ==================================================
echo.

if exist "%CD%\package.json" goto :dir_ok
if exist "%~dp0package.json" (
    cd /d "%~dp0"
    goto :dir_ok
)
if exist "%CD%\.git" goto :dir_ok
if exist "%~dp0.git" (
    cd /d "%~dp0"
    goto :dir_ok
)

echo [ERROR] Could not find package.json or .git in current folder: %CD%
echo         Please run this script inside your Project-schedule-adjustment-app folder.
goto :end_fail

:dir_ok
echo Working Dir : %CD%

set "DEFAULT_HTTPS_REMOTE=https://github.com/jamesldswang/Project-schedule-adjustment-app.git"
set "REPO_URL=https://github.com/jamesldswang/Project-schedule-adjustment-app"

set "RAW_VER=%~1"
if not defined RAW_VER if exist "package.json" (
    for /f "delims=" %%V in ('node -p "require('./package.json').version" 2^>nul') do set "RAW_VER=%%V"
)

where git >nul 2>&1
if errorlevel 1 (
    echo [WARN] git command not found. Skipping Git sync/tag and launching current folder.
    goto :have_ver
)

if not exist ".git" (
    echo [INIT] Initializing local Git repository ^(branch: main^)...
    git init -b main
    if errorlevel 1 goto :fail
    git config user.name "jamesldswang"
    git config user.email "james.wang@nadisystem.com.tw"
    git add -A
    git commit -m "chore(release): initial import"
)

set "RAW_REMOTE="
for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "RAW_REMOTE=%%U"
if not defined RAW_REMOTE (
    echo [INIT] Adding GitHub remote origin: %DEFAULT_HTTPS_REMOTE%
    git remote add origin "%DEFAULT_HTTPS_REMOTE%"
    set "RAW_REMOTE=%DEFAULT_HTTPS_REMOTE%"
)

for /f "delims=" %%U in ('node -e "var u=process.argv[1].trim().replace(/\.git$/,'');if(u.indexOf('git@')===0){u='https://'+u.slice(4).replace(':','/')}else if(u.indexOf('ssh://git@')===0){u='https://'+u.slice(10)}console.log(u);" "%RAW_REMOTE%" 2^>nul') do set "REPO_URL=%%U"

set "CUR_BRANCH="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "CUR_BRANCH=%%B"
if not defined CUR_BRANCH set "CUR_BRANCH=main"
echo Branch      : %CUR_BRANCH%
echo Remote      : %RAW_REMOTE%
echo.

REM Ensure GitHub credential helper / CLI auth is active before network operations
git config --global credential.helper manager >nul 2>&1
where gh >nul 2>&1
if not errorlevel 1 (
    gh auth status >nul 2>&1
    if errorlevel 1 (
        echo [AUTH] GitHub CLI not logged in. Launching browser login...
        gh auth login --hostname github.com --git-protocol https --web
        if not errorlevel 1 gh auth setup-git
    )
)

set "OLD_HEAD="
for /f "delims=" %%H in ('git rev-parse HEAD 2^>nul') do set "OLD_HEAD=%%H"

echo [1/4] Syncing remote branch and tags ^(git fetch + git pull origin %CUR_BRANCH%^) ...
git fetch origin --tags --force 2>nul
if errorlevel 1 (
    echo [INFO] Remote fetch skipped or repository is empty/requires auth on push.
    goto :after_pull
)

git ls-remote --exit-code --heads origin "%CUR_BRANCH%" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Remote branch %CUR_BRANCH% does not exist on GitHub yet. Will push on step 2.
    goto :after_pull
)

git pull origin "%CUR_BRANCH%" --allow-unrelated-histories
if not errorlevel 1 goto :after_pull

echo.
echo [INFO] git pull blocked by local changes. Checking if only .bat files differ...
node -e "const cp=require('child_process');const out=cp.execSync('git status --porcelain',{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);const onlyBat=out.length>0 && out.every(l=>l.slice(3).trim().endsWith('.bat') || l.slice(3).trim().endsWith('.gitattributes'));process.exit(onlyBat?0:1);" >nul 2>&1
if errorlevel 1 goto :fail

echo [INFO] Resetting .bat line-ending state to origin/%CUR_BRANCH% ...
git reset --hard "origin/%CUR_BRANCH%"
if errorlevel 1 goto :fail

:after_pull
set "NEW_HEAD="
for /f "delims=" %%H in ('git rev-parse HEAD 2^>nul') do set "NEW_HEAD=%%H"
if defined GAIS_RELAUNCHED goto :read_version
if defined OLD_HEAD if defined NEW_HEAD if not "%OLD_HEAD%"=="%NEW_HEAD%" (
    set "GAIS_RELAUNCHED=1"
    echo [INFO] Updated scripts pulled from GitHub. Continuing with updated script...
    echo.
    call "%~f0" %*
    exit /b %ERRORLEVEL%
)

:read_version
set "RAW_VER=%~1"
if not defined RAW_VER if exist "package.json" (
    for /f "delims=" %%V in ('node -p "require('./package.json').version" 2^>nul') do set "RAW_VER=%%V"
)

:have_ver
if not defined RAW_VER (
    echo [ERROR] Failed to read version from package.json in %CD%.
    goto :end_fail
)

if /i "%RAW_VER:~0,1%"=="v" (
    set "TAG_NAME=%RAW_VER%"
) else (
    set "TAG_NAME=v%RAW_VER%"
)
set "PKG_VER=%TAG_NAME:~1%"

if not exist ".git" goto :ensure_local_server
where git >nul 2>&1
if errorlevel 1 goto :ensure_local_server

echo.
echo [2/4] Pushing branch %CUR_BRANCH% and checking tag %TAG_NAME% ...

git push -u origin "%CUR_BRANCH%"
if errorlevel 1 (
    echo.
    echo [AUTH] Push failed. Launching GitHub authentication setup...
    if exist "%CD%\setup_github_auth.bat" (
        call "%CD%\setup_github_auth.bat" --no-pause
        if errorlevel 1 goto :fail
        git push -u origin "%CUR_BRANCH%"
        if errorlevel 1 goto :fail
    ) else (
        goto :fail
    )
)

git ls-remote --exit-code --tags origin "refs/tags/%TAG_NAME%" >nul 2>&1
if not errorlevel 1 goto :remote_tag_exists

git rev-parse -q --verify "refs/tags/%TAG_NAME%" >nul 2>&1
if not errorlevel 1 goto :push_existing_tag

echo       Creating local tag %TAG_NAME% ...
git tag -a "%TAG_NAME%" -m "Release %TAG_NAME% - Project-schedule-adjustment-app"
if errorlevel 1 goto :fail
goto :push_tag

:push_existing_tag
echo       Local tag %TAG_NAME% already exists. Pushing to GitHub ...

:push_tag
echo.
echo [3/4] Pushing tag %TAG_NAME% to trigger GitHub Actions Release ...
git push origin "%TAG_NAME%"
if errorlevel 1 goto :fail
echo [DONE] Pushed %TAG_NAME%. GitHub Actions will build and publish Project-schedule-adjustment-app-%TAG_NAME%.
goto :ensure_local_server

:remote_tag_exists
git fetch origin "refs/tags/%TAG_NAME%:refs/tags/%TAG_NAME%" --force >nul 2>&1
echo [DONE] Tag %TAG_NAME% already exists on GitHub ^(auto-released by Actions^).

:ensure_local_server
echo.
echo [4/4] Checking local Schedule App server ^(expected v%PKG_VER% at http://localhost:3000/^) ...
set "LOCAL_READY=0"
node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode>=200&&r.statusCode<400?0:1)).on('error',()=>process.exit(1));" >nul 2>&1
if not errorlevel 1 (
    set "LOCAL_READY=1"
    echo [OK] Local server is already running at http://localhost:3000/
    goto :show_urls
)

if not exist "%CD%\start_schedule_app.bat" (
    echo [WARN] start_schedule_app.bat not found in %CD%.
    goto :show_urls
)

echo       Starting Schedule App v%PKG_VER% from %CD% ...
start "Schedule App Server" /D "%CD%" cmd /k start_schedule_app.bat
node -e "const h=require('http');let n=0;function c(){n++;let f=0;const next=()=>{if(f)return;f=1;if(n===120)process.exit(1);setTimeout(c,1000);};const r=h.get('http://127.0.0.1:3000/',res=>{if(res.statusCode>=200&&res.statusCode<400)process.exit(0);next();});r.on('error',next);r.setTimeout(1000,()=>{r.destroy();next();});}c();" >nul 2>&1
if not errorlevel 1 (
    set "LOCAL_READY=1"
    echo [OK] Local server v%PKG_VER% is ready at http://localhost:3000/
) else (
    echo [INFO] Server is still building/starting. Check the "Schedule App Server" window.
)

:show_urls
echo.
echo --------------------------------------------------
echo Working Dir   : %CD%
if defined REPO_URL (
    echo Release URL   : %REPO_URL%/releases/tag/%TAG_NAME%
    echo All Releases  : %REPO_URL%/releases
    echo Actions URL   : %REPO_URL%/actions
    echo GitHub Repo   : %REPO_URL%
)
if "%LOCAL_READY%"=="1" (
    echo Local App URL : http://localhost:3000/  ^(v%PKG_VER% RUNNING - Ready to use^)
) else (
    echo Local App URL : http://localhost:3000/  ^(See Schedule App Server window^)
)
echo --------------------------------------------------
echo.
pause
exit /b 0

:fail
echo.
echo [FAILED] An error occurred above. Please check the output.
if defined REPO_URL (
    echo.
    echo GitHub Repo   : %REPO_URL%
    echo Actions URL   : %REPO_URL%/actions
)

:end_fail
echo.
echo Working Dir   : %CD%
echo Local App URL : http://localhost:3000/  ^(Run start_schedule_app.bat to use^)
echo.
pause
exit /b 1

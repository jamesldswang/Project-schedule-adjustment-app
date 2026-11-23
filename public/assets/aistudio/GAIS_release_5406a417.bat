@echo off
setlocal EnableExtensions

echo ==================================================
echo   API_Cat - Current Folder Launcher ^& Git Release
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
echo         Please run this script inside your API_Cat folder.
goto :end_fail

:dir_ok
echo Working Dir : %CD%

set "RAW_VER=%~1"
if not defined RAW_VER if exist "package.json" (
    for /f "delims=" %%V in ('node -p "require('./package.json').version" 2^>nul') do set "RAW_VER=%%V"
)

set "REPO_URL=https://github.com/jamesldswang/API_Cat"

if not exist ".git" (
    echo [INFO] No .git in current folder ^(extracted release package^).
    echo        Skipping Git sync/tag and launching current folder directly.
    goto :have_ver
)

where git >nul 2>&1
if errorlevel 1 (
    echo [WARN] git command not found. Skipping Git sync/tag and launching current folder.
    goto :have_ver
)

set "RAW_REMOTE="
for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "RAW_REMOTE=%%U"
if not defined RAW_REMOTE goto :after_url
for /f "delims=" %%U in ('node -e "var u=process.argv[1].trim().replace(/\.git$/,'');if(u.indexOf('git@')===0){u='https://'+u.slice(4).replace(':','/')}else if(u.indexOf('ssh://git@')===0){u='https://'+u.slice(10)}console.log(u);" "%RAW_REMOTE%" 2^>nul') do set "REPO_URL=%%U"

:after_url
set "CUR_BRANCH="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "CUR_BRANCH=%%B"
if not defined CUR_BRANCH set "CUR_BRANCH=main"
echo Branch      : %CUR_BRANCH%
echo.

set "OLD_HEAD="
for /f "delims=" %%H in ('git rev-parse HEAD 2^>nul') do set "OLD_HEAD=%%H"

echo [1/4] Syncing remote branch and tags ^(git fetch + git pull origin %CUR_BRANCH%^) ...
git fetch origin --tags --force
if errorlevel 1 goto :fail

git pull origin "%CUR_BRANCH%"
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
if not "%OLD_HEAD%"=="%NEW_HEAD%" (
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
echo [2/4] Checking tag %TAG_NAME% ...

git ls-remote --exit-code --tags origin "refs/tags/%TAG_NAME%" >nul 2>&1
if not errorlevel 1 goto :remote_tag_exists

git rev-parse -q --verify "refs/tags/%TAG_NAME%" >nul 2>&1
if not errorlevel 1 goto :push_existing_tag

echo       Creating local tag %TAG_NAME% ...
git tag -a "%TAG_NAME%" -m "Release %TAG_NAME% - API_Cat"
if errorlevel 1 goto :fail
goto :push_tag

:push_existing_tag
echo       Local tag %TAG_NAME% already exists. Pushing to GitHub ...

:push_tag
echo.
echo [3/4] Pushing tag %TAG_NAME% to trigger GitHub Actions Release ...
git push origin "%TAG_NAME%"
if errorlevel 1 goto :fail
echo [DONE] Pushed %TAG_NAME%. GitHub Actions will build and publish API_Cat-%TAG_NAME%.
goto :ensure_local_server

:remote_tag_exists
git fetch origin "refs/tags/%TAG_NAME%:refs/tags/%TAG_NAME%" --force >nul 2>&1
echo [DONE] Tag %TAG_NAME% already exists on GitHub ^(auto-released by Actions^).

:ensure_local_server
echo.
echo [4/4] Checking local API_Cat server ^(expected v%PKG_VER% at http://localhost:3000/^) ...
set "LOCAL_READY=0"
set "RUN_VER="
for /f "delims=" %%V in ('node -e "require('http').get('http://127.0.0.1:3000/api/health',function(r){var d='';r.on('data',function(c){d+=c});r.on('end',function(){try{var j=JSON.parse(d);if(r.statusCode===200)if(j.service==='API_Cat')console.log(j.version?j.version:'')}catch(e){}})}).on('error',function(){})" 2^>nul') do set "RUN_VER=%%V"

if not defined RUN_VER goto :start_server
if "%RUN_VER%"=="%PKG_VER%" (
    set "LOCAL_READY=1"
    echo [OK] Local server v%RUN_VER% is already running at http://localhost:3000/
    goto :show_urls
)

echo [INFO] Port 3000 is running older API_Cat v%RUN_VER%. Stopping old process to upgrade to v%PKG_VER%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

:start_server
if not exist "%CD%\start_API_Cat.bat" (
    echo [WARN] start_API_Cat.bat not found in %CD%.
    goto :show_urls
)

echo       Starting API_Cat v%PKG_VER% from %CD% ...
start "API_Cat Server" /D "%CD%" cmd /k start_API_Cat.bat
node -e "const h=require('http');let n=0;function c(){n++;let f=0;const next=()=>{if(f)return;f=1;if(n===120)process.exit(1);setTimeout(c,1000);};const r=h.get('http://127.0.0.1:3000/api/health',res=>{let d='';res.on('data',ch=>d+=ch);res.on('end',()=>{try{const j=JSON.parse(d);if(res.statusCode===200 && j.version===process.argv[1])process.exit(0);}catch{}next();});});r.on('error',next);r.setTimeout(1000,()=>{r.destroy();next();});}c();" "%PKG_VER%" >nul 2>&1
if not errorlevel 1 (
    set "LOCAL_READY=1"
    echo [OK] Local server v%PKG_VER% is ready at http://localhost:3000/
) else (
    echo [INFO] Server is still building/starting. Check the "API_Cat Server" window.
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
    echo Local App URL : http://localhost:3000/  ^(See API_Cat Server window^)
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
echo Local App URL : http://localhost:3000/  ^(Run start_API_Cat.bat to use^)
echo.
pause
exit /b 1

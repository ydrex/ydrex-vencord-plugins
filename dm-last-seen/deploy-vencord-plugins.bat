@echo off
setlocal EnableExtensions

title install dmLastSeen

set "REPO_DIR=%~dp0"
set "DEPLOY_DIR=%APPDATA%\Vencord\dist"

echo.
echo  dmLastSeen installer
echo  ====================
echo.
echo  paste your vencord folder path
echo  the folder that contains package.json
echo.
echo  example: C:\Users\you\Documents\Vencord
echo.

set /p "VENCORD_DIR=path: "
set "VENCORD_DIR=%VENCORD_DIR:"=%"

if "%VENCORD_DIR%"=="" (
    echo no path entered
    pause
    exit /b 1
)

if not exist "%VENCORD_DIR%\package.json" (
    echo.
    echo vencord not found at:
    echo %VENCORD_DIR%
    echo.
    echo check the path and try again
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo pnpm missing. install it first
    pause
    exit /b 1
)

if not exist "%VENCORD_DIR%\src\userplugins" mkdir "%VENCORD_DIR%\src\userplugins"

echo.
echo copying dmLastSeen...
if exist "%VENCORD_DIR%\src\userplugins\dmLastSeen" rmdir /S /Q "%VENCORD_DIR%\src\userplugins\dmLastSeen"
xcopy /E /Y /I "%REPO_DIR%userplugins\dmLastSeen" "%VENCORD_DIR%\src\userplugins\dmLastSeen\" >nul

cd /d "%VENCORD_DIR%"
set "VENCORD_HASH=local"

echo building vencord...
call pnpm build
if errorlevel 1 (
    echo build failed
    pause
    exit /b 1
)

echo copying dist to discord...
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"
xcopy /E /Y /I "%VENCORD_DIR%\dist\*" "%DEPLOY_DIR%\" >nul

echo.
echo done.
echo restart discord fully.
echo keep vencord auto update OFF.
pause

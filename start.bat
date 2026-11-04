@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo =========================================
echo   Draythos — Vhagar Backend Launcher
echo =========================================

REM ── Check Python 3 ──────────────────────────────────────────────
where python3 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    where python >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo ERROR: python is not installed or not on PATH.
        echo Please install Python 3.10+ and try again.
        exit /b 1
    )
    set PYTHON_CMD=python
) else (
    set PYTHON_CMD=python3
)

for /f "tokens=*" %%i in ('!PYTHON_CMD! -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set PYTHON_VERSION=%%i
for /f "tokens=*" %%i in ('!PYTHON_CMD! -c "import sys; print(sys.version_info.major)"') do set PYTHON_MAJOR=%%i
for /f "tokens=*" %%i in ('!PYTHON_CMD! -c "import sys; print(sys.version_info.minor)"') do set PYTHON_MINOR=%%i

if !PYTHON_MAJOR! lss 3 (
    echo ERROR: Python 3.10+ is required. Found Python !PYTHON_VERSION!.
    exit /b 1
)
if !PYTHON_MAJOR! equ 3 if !PYTHON_MINOR! lss 10 (
    echo ERROR: Python 3.10+ is required. Found Python !PYTHON_VERSION!.
    exit /b 1
)

echo [OK] Python !PYTHON_VERSION! detected

REM ── Create virtual environment if missing ───────────────────────
set VENV_DIR=%~dp0.venv

if not exist "%VENV_DIR%" (
    echo Creating virtual environment...
    !PYTHON_CMD! -m venv "%VENV_DIR%"
    echo [OK] Virtual environment created at %VENV_DIR%
) else (
    echo [OK] Virtual environment found
)

REM ── Activate venv ───────────────────────────────────────────────
call "%VENV_DIR%\Scripts\activate.bat"

REM ── Install / upgrade dependencies ──────────────────────────────
echo Installing dependencies...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo [OK] Dependencies installed

REM ── Create data directories ─────────────────────────────────────
if not exist "data\documents" mkdir "data\documents"
if not exist "data\index_overflow" mkdir "data\index_overflow"
if not exist "data\working_copies" mkdir "data\working_copies"
if not exist "logs" mkdir "logs"
echo [OK] Data directories ready

REM ── Start Vhagar ────────────────────────────────────────────────
echo.
echo Starting Vhagar server...
echo -----------------------------------------
!PYTHON_CMD! -m vhagar %*

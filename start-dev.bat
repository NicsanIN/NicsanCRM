@echo off
echo Starting Nicsan CRM Development Environment...

REM Kill any existing processes on our ports
echo Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1

REM Start backend in background
echo Starting backend server...
cd nicsan-crm-backend
start "Backend Server" cmd /k "npm run dev"
cd ..

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend
echo Starting frontend server...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Development servers started!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3001
echo.
echo Press any key to exit...
pause >nul

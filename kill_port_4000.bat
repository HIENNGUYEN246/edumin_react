@echo off
:: Batch script to free port 4000 with admin rights
title Giai phong cong 4000 Edumin
color 0A
echo ===================================================
echo     DANG GIAI PHONG CONG 4000 CHO EDUMIN BACKEND
echo ===================================================
echo.

:: Find and kill any PID holding port 4000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do (
  if not "%%a"=="0" (
    echo [Dang tat] Tien trinh PID %%a dang chiem cong 4000...
    taskkill /f /t /pid %%a
  )
)

echo.
echo ===================================================
echo     DA GIAI PHONG XONG! BAN CO THE CHAY LAI:
echo     npm run dev
echo ===================================================
echo.
pause


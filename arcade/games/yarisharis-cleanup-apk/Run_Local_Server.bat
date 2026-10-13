@echo off
title Cleanup Protocol - Local Game Server
echo ========================================================
echo   CLEANUP PROTOCOL: REVOLT AT HOME (IEEE GAMEATHON 2026)
echo   Local Web Server Starting on Port 8080...
echo ========================================================
echo.
echo Open your browser at: http://localhost:8080
echo Other devices on same Wi-Fi can play by typing your laptop IP:8080
echo.
python -m http.server 8080
pause

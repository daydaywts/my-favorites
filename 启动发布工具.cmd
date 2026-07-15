@echo off
chcp 65001 >nul
title Favorites Deploy Tool
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js was not found.
  echo Install Node.js and then run this file again.
  echo.
  pause
  exit /b 1
)

node tools\deploy-server.mjs
if errorlevel 1 (
  echo.
  echo The deploy tool stopped with an error. See the message above.
  echo.
  pause
)

@echo off
title Rumo a Taca
cd /d "%~dp0"
echo Abrindo o jogo Rumo a Taca...
start "" /min node servidor.js
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
echo.
echo O jogo esta aberto no navegador. Para fechar o servidor, feche a janela "node".
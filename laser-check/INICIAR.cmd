@echo off
cd /d "%~dp0"
echo Abra http://localhost:4173 no navegador.
echo Mantenha esta janela aberta enquanto usar o aplicativo.
node server.mjs
pause

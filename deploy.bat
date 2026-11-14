@echo off
title ZYON - Deploy Automatico
color 0A
cd /d "%~dp0"

echo ==========================================
echo    ZYON - DEPLOY AUTOMATICO
echo ==========================================
echo.

:: ---------- Verifica se o Git esta instalado ----------
where git >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERRO] Git nao encontrado!
    echo Instale em: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

:: ---------- Verifica se ha alteracoes ----------
git status --porcelain >nul 2>nul
for /f %%i in ('git status --porcelain 2^>nul ^| find /c /v ""') do set MUDANCAS=%%i

if "%MUDANCAS%"=="0" (
    echo [i] Nenhuma alteracao para enviar.
    echo.
    set /p FORCAR="Forcar deploy mesmo assim? (S/N): "
    if /i not "%FORCAR%"=="S" exit /b 0
)

:: ---------- Mostra o que mudou ----------
echo [i] Arquivos alterados:
git status --short
echo.

:: ---------- Pede mensagem do commit ----------
set /p MSG="Mensagem do commit (Enter = padrao): "
if "%MSG%"=="" set MSG="Atualizacao do site ZYON"

:: ---------- Commit e push ----------
echo.
echo [1/2] Enviando para o GitHub...
git add -A
git commit -m %MSG%
if errorlevel 1 (
    echo [i] Nada novo para commitar, continuando...
)
git push origin main
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Falha no push!
    echo Talvez o git peca login: uma janela pode abrir para autorizar.
    echo.
    pause
    exit /b 1
)
echo [OK] GitHub atualizado!
echo.

:: ---------- Deploy na Vercel ----------
echo [2/2] Deploy na Vercel...
where vercel >nul 2>nul
if not errorlevel 1 goto :VERCELCLI

:: CLI nao instalada - tenta via npx
where npx >nul 2>nul
if not errorlevel 1 goto :NPXVERCEL

:: Sem CLI nem npx - abre o painel manual
echo [i] CLI da Vercel nao encontrada.
echo     Vou abrir o painel da Vercel para o deploy acontecer pelo GitHub.
echo     (Se o GitHub esta conectado a Vercel, o site atualiza sozinho!)
echo.
start "" https://vercel.com/dashboard
color 0B
echo ==========================================
echo    PUSH FEITO! Verifique o painel da Vercel.
echo ==========================================
echo.
pause
exit /b 0

:NPXVERCEL
echo [i] Rodando via npx (primeira vez pode demorar)...
call npx -y vercel --prod --yes
goto :FIM

:VERCELCLI
vercel --prod --yes
goto :FIM

:FIM
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Falha no deploy da Vercel.
    echo Dica: rode "vercel login" uma vez e depois este .bat de novo.
    echo.
) else (
    color 0A
    echo.
    echo ==========================================
    echo    DEPLOY CONCLUIDO COM SUCESSO! 🎉
    echo ==========================================
)
echo.
pause

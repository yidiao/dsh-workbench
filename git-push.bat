@echo off
REM ============================================================
REM dsh-workbench push launcher - ASCII ONLY ON PURPOSE.
REM cmd.exe batch parsing corrupts multibyte content (codepage
REM bugs), so all logic and Chinese text live in git-push.ps1.
REM Do NOT add Chinese text to this file.
REM ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-push.ps1"
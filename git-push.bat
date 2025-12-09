@echo off
REM Usage: git-push "commit message"

REM Go to repo root (WebSLM)
cd /d E:\PycharmProjects\SLM_v1.0\WebSLM

REM Show current status
git status

REM Add all changes
git add -A

REM If a commit message was passed, use it; otherwise prompt
if "%~1"=="" (
    set /p msg=Enter commit message: 
) else (
    set msg=%*
)

REM Commit
git commit -m "%msg%"

REM Push to the current branch's remote
git push
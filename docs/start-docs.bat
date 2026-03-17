@echo off
echo ================================
echo   Pixel Swift Docs (Docsify)
echo ================================
echo.
echo 正在启动文档服务器...
echo 访问地址: http://localhost:3001
echo 按 Ctrl+C 停止服务器
echo.
npx -y docsify-cli serve . -p 3001
pause

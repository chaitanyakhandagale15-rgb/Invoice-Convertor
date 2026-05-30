@echo off
echo Preparing to push to GitHub...

git init
git add .
git commit -m "release: InvoiceBridge v2 production launch"
git branch -M main

set /p REPO_URL="Enter your GitHub repository URL (e.g. https://github.com/username/InvoiceBridge.git): "
git remote add origin %REPO_URL%
git push -u origin main

echo Done!

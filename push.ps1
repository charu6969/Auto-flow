git init
git add .
git commit -m "Initialize Render configuration"
git remote remove origin 2>$null
git remote add origin https://github.com/charu6969/Auto-flow.git
git branch -M main
git push -u origin main -f

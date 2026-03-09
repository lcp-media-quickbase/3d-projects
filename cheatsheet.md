# Git Cheatsheet

## Daily Start
git pull origin main

## New Feature Branch
git checkout -b nick/feature-name

## Commit Work
git add -A
git commit -m "description"
git push origin nick/feature-name

## Merge to Main
git checkout main
git pull origin main
git merge nick/feature-name
git push origin main
git branch -d nick/feature-name

## Deploy
git tag vX.Y.Z
git push origin vX.Y.Z
# update version in codepages/version.json
git add -A
git commit -m "bump version"
git push origin main
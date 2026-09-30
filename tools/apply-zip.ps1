# Applies the newest Voidation zip from Downloads to your code folder, then
# commits it (with the title line of the zip's COMMIT.txt) and pushes.
#
# One-time setup: copy this file to D:\voidation\apply-zip.ps1
# Every time:     powershell -ExecutionPolicy Bypass -File D:\voidation\apply-zip.ps1
# Options:        -Zip "C:\path\to\voidation.zip"   use a specific zip
#                 -NoPush                           commit but don't push
param(
  [string]$Zip,
  [string]$Repo = "D:\voidation\voidation-code",
  [switch]$NoPush
)
$ErrorActionPreference = "Stop"

# 1. find the zip: the newest voidation*.zip in Downloads (not voidation-app)
if (-not $Zip) {
  $latest = Get-ChildItem "$HOME\Downloads\voidation*.zip" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "voidation-app*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "No voidation*.zip found in $HOME\Downloads" }
  $Zip = $latest.FullName
}
Write-Host "Zip:  $Zip"
if (-not (Test-Path "$Repo\.git")) { throw "$Repo isn't linked to GitHub (no .git folder). Stopping." }

# 2. unzip to a temporary folder and read the commit title
$tmp = Join-Path $env:TEMP ("voidation-" + [guid]::NewGuid())
Expand-Archive -Path $Zip -DestinationPath $tmp
$src = Join-Path $tmp "voidation"
if (-not (Test-Path "$src\package.json")) { Remove-Item -Recurse -Force $tmp; throw "The zip has no voidation folder inside." }
$title = if (Test-Path "$src\COMMIT.txt") { (Get-Content "$src\COMMIT.txt" -TotalCount 1).Trim() } else { "" }
if (-not $title) { $title = "Update from zip " + (Get-Date -Format "yyyy-MM-dd HH:mm") }
Write-Host "Commit: $title"

# 3. copy it over the code folder (keeps git, installed packages, and your .env files)
$lockBefore = if (Test-Path "$Repo\package-lock.json") { (Get-FileHash "$Repo\package-lock.json").Hash } else { "" }
robocopy $src $Repo /MIR /XD .git node_modules .expo dist android ios .check-bundle /XF .env .env.local .env.example COMMIT.txt /NFL /NDL /NJH /NJS /NP | Out-Null
$copyCode = $LASTEXITCODE
Copy-Item "$src\COMMIT.txt" "$Repo\COMMIT.txt" -ErrorAction SilentlyContinue  # for reference; git ignores it
Remove-Item -Recurse -Force $tmp
if ($copyCode -ge 8) { throw "Copying failed (robocopy code $copyCode). Nothing was committed." }

Push-Location $Repo
try {
  # 4. new or changed packages: install them
  $lockAfter = if (Test-Path "package-lock.json") { (Get-FileHash "package-lock.json").Hash } else { "" }
  if ($lockAfter -ne $lockBefore) { Write-Host "Packages changed: npm install"; npm install }

  # 5. commit and push
  git add -A
  if (-not (git status --porcelain)) { Write-Host "Nothing changed. Nothing to commit."; return }
  git commit -m $title
  if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
  if ($NoPush) { Write-Host "Committed (not pushed)." }
  else {
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed. Your commit is saved; run 'git push' again later." }
    Write-Host "Done: committed and pushed."
  }
} finally { Pop-Location }

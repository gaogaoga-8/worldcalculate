$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root ".data"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$key = Join-Path $env:USERPROFILE ".ssh\shijie-vfkc"
$ssh = @("-i", $key, "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=25")
$remote = "admin@8.218.96.229"
scp @ssh (Join-Path $PSScriptRoot "dump-server-db.cjs") "${remote}:/tmp/dump-server-db.cjs"
ssh @ssh $remote "sudo -n -u www-data /opt/node-v24/bin/node /tmp/dump-server-db.cjs > /tmp/shijie-snapshot.json"
if ($LASTEXITCODE -ne 0) { throw "remote dump failed" }
$dest = Join-Path $destDir "server-snapshot.json"
scp @ssh "${remote}:/tmp/shijie-snapshot.json" $dest
ssh @ssh $remote "rm -f /tmp/dump-server-db.cjs /tmp/shijie-snapshot.json" | Out-Null
Write-Output $dest

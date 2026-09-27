param([string]$InnoCompiler)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $projectRoot
try {
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if (!(Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
    if (!(Test-Path $csc)) { throw 'Для сборки требуется компилятор .NET Framework 4.' }
    if (!$InnoCompiler) { $InnoCompiler = Join-Path $projectRoot '.tmp/inno/compiler/ISCC.exe' }
    if (!(Test-Path $InnoCompiler)) { throw 'Укажите путь к ISCC.exe: -InnoCompiler <путь>' }
    $assets = @('index.html','demo-quest.json','app.js','image-editor.js','graph-editor.js','graph-area.js','graph-navigation.js','path-editor.js','rules.js','zones.js','storage.js','saves.js','scene-layers.js','character-editor.js','html-export.js','style.css')
    New-Item -ItemType Directory -Force -Path 'dist/portable' | Out-Null
    $compilerArgs = @('/nologo','/target:winexe','/platform:anycpu','/optimize+','/out:dist/portable/Macroquest.exe','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll')
    foreach ($asset in $assets) { $compilerArgs += '/resource:' + $asset + ',site.' + $asset }
    $compilerArgs += (Join-Path $projectRoot 'packaging\windows\Launcher.cs')
    & $csc @compilerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Сборка приложения не удалась.' }
    $check = Start-Process -FilePath 'dist/portable/Macroquest.exe' -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
    if ($check.ExitCode -ne 0) { throw 'Проверка встроенных ресурсов не прошла.' }
    Copy-Item 'packaging/windows/README.txt' 'dist/portable/README.txt'
    & $InnoCompiler (('/DAppVersion=' + $version)) 'packaging/windows/installer.iss'
    if ($LASTEXITCODE -ne 0) { throw 'Сборка установщика не удалась.' }
    Compress-Archive -Path 'dist/portable/*' -DestinationPath ('dist/Macroquest-' + $version + '-Portable.zip') -Force
    Get-FileHash ('dist/Macroquest-' + $version + '-Setup.exe'),('dist/Macroquest-' + $version + '-Portable.zip') -Algorithm SHA256 |
        ForEach-Object { $_.Hash + '  ' + [IO.Path]::GetFileName($_.Path) } | Set-Content 'dist/SHA256SUMS.txt'
    Write-Host 'Готово: установщик и portable ZIP находятся в dist.'
} finally { Pop-Location }


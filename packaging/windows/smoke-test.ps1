param([string]$Executable = 'dist/portable/Macroquest.exe')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $projectRoot
try {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $probe.Start(); $testPort = $probe.LocalEndpoint.Port; $probe.Stop()
    $server = Start-Process -FilePath $Executable -ArgumentList '--serve-only', ('--port=' + $testPort) -WindowStyle Hidden -PassThru
    try {
        $url = 'http://127.0.0.1:' + $testPort
        $ready = $false
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if ($server.HasExited) { throw 'Launcher stopped unexpectedly.' }
            try { $health = Invoke-WebRequest ($url + '/__macroquest/health') -UseBasicParsing -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 100 }
        }
        if (!$ready -or $health.Headers['X-Macroquest-App'] -ne 'macroquest') { throw 'Health check failed.' }
        foreach ($file in @('index.html','style.css','scene-layers.js','demo-quest.json')) {
            $response = Invoke-WebRequest ($url + '/' + $file) -UseBasicParsing
            $expected = [IO.File]::ReadAllText((Join-Path $projectRoot $file))
            if ($response.Content -cne $expected) { throw ('Embedded content mismatch: ' + $file) }
        }
        $head = Invoke-WebRequest ($url + '/index.html') -Method Head -UseBasicParsing
        if ([int](@($head.Headers['Content-Length'])[0]) -ne (Get-Item 'index.html').Length) { throw 'HEAD length mismatch.' }
        foreach ($path in @('/missing.txt','/.env','/packaging/windows/Launcher.cs','/%2e%2e/package.json')) {
            try { Invoke-WebRequest ($url + $path) -UseBasicParsing | Out-Null; throw ('Unexpected file access: ' + $path) }
            catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
        }
        try { Invoke-WebRequest ($url + '/') -Method Post -UseBasicParsing | Out-Null; throw 'POST unexpectedly accepted' }
        catch { if ([int]$_.Exception.Response.StatusCode -ne 405) { throw } }
        try { Invoke-WebRequest ($url + '/') -Headers @{Host='unrelated.example'} -UseBasicParsing | Out-Null; throw 'Foreign host unexpectedly accepted' }
        catch { if ([int]$_.Exception.Response.StatusCode -ne 403) { throw } }
        Write-Host 'PASS: loopback health, embedded HTML/JS/CSS/demo, HEAD, unknown files, method and host restrictions.'
    } finally { if (!$server.HasExited) { Stop-Process -Id $server.Id; $server.WaitForExit() } }
} finally { Pop-Location }


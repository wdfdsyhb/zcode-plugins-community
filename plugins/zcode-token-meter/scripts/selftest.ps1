$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$m = Get-ZmMetrics
$sw.Stop()
Write-Output ("metrics query: " + $sw.ElapsedMilliseconds + " ms")
if ($null -eq $m) { Write-Output 'NO DATA'; exit }
Write-Output ("session : " + $m.SessionId)
Write-Output ("model   : " + $m.ModelId)
Write-Output ("speed   : " + (Format-ZmSpeed $m.SpeedLast) + " tok/s  (last request, " + $m.LastOut + " out tokens)")
Write-Output ("cache   : " + (Format-ZmPercent $m.CacheHit))
Write-Output ("requests: " + $m.Requests + "  out=" + (Format-ZmCount $m.SumOut) + "  in=" + (Format-ZmCount $m.SumIn) + "  cacheRead=" + (Format-ZmCount $m.SumCacheRead))
Write-Output ("speeds history (" + $m.Speeds.Count + "): " + (($m.Speeds | ForEach-Object { [math]::Round($_, 1) }) -join ', '))

$sw.Restart()
$live = Get-ZmLiveState -SessionId $m.SessionId
$sw.Stop()
Write-Output ("live query: " + $sw.ElapsedMilliseconds + " ms")
Write-Output ("live    : streaming=" + $live.Streaming + " startedAtMs=" + $live.StartedAtMs)
if ($live.Streaming) { Write-Output ("elapsed : " + [math]::Round(((Get-Date).ToUniversalTime().ToFileTime() / 10000 - 11644473600000 - $live.StartedAtMs) / 1000, 1) + " s") }

# repeated poll timing
$sw.Restart()
for ($i = 0; $i -lt 10; $i++) { $null = Get-ZmMetrics; $null = Get-ZmLiveState -SessionId $m.SessionId }
$sw.Stop()
Write-Output ("10 full polls: " + $sw.ElapsedMilliseconds + " ms")

# tokenmeter CLI - start/stop/toggle the floating widget and print its metrics
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File meter.ps1 -Action start
#   ... -Action stop | toggle | status | ensure
#
# -Action status prints a one-line text summary (also used by the /tokenmeter command).

param(
  [string]$Action = 'status',
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')

# Empty or unknown actions fall back to "status" so the /tokenmeter command can
# forward $ARGUMENTS verbatim, including when the user typed none.
$Action = ([string]$Action).Trim().ToLowerInvariant()
if ($Action -notin @('start', 'stop', 'toggle', 'status', 'ensure')) { $Action = 'status' }

$vbs = Join-Path $PSScriptRoot 'start-hidden.vbs'

function Get-ZmWidgetProcess {
  # Match on "-File ...widget.ps1" so shell one-liners that merely mention
  # widget.ps1 (for example a process query) are not counted as the widget.
  # Every call site wraps the call with @() so results stay arrays.
  $procs = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like '*-File*widget.ps1*' })
  return $procs
}

function Start-ZmWidget {
  param([switch]$Auto)
  $running = @(Get-ZmWidgetProcess)
  if ($running.Count -gt 0) { return $false }
  $mode = if ($Auto) { 'ensure' } else { 'run' }
  # wscript spawns the window via WMI, fully detached, no console flash.
  Start-Process -FilePath 'wscript.exe' -ArgumentList @('//nologo', ('"' + $vbs + '"'), $mode) -WindowStyle Hidden | Out-Null
  return $true
}

function Stop-ZmWidget {
  $procs = @(Get-ZmWidgetProcess)
  if ($procs.Count -eq 0) { return $false }
  foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  return $true
}

function Get-ZmStatusLine {
  $m = Prepare-ZmForText (Get-ZmMetrics)
  if ($null -eq $m) { return 'token meter: no usage data yet' }
  $live = Get-ZmLiveState -SessionId $m.SessionId
  $state = if ($live.Streaming) { 'streaming' } else { 'idle' }
  $run = if (@(Get-ZmWidgetProcess).Count -gt 0) { 'on' } else { 'off' }
  return ('token meter [{0}] · {1} tok/s · cache hit {2} · session {3} reqs, {4} out tokens · window {5}' -f
    $state, (Format-ZmSpeed $m.SpeedLast), (Format-ZmPercent $m.CacheHit), $m.Requests, (Format-ZmCount $m.SumOut), $run)
}

# Text-only variant of the widget's model label cleanup.
function Prepare-ZmForText {
  param($Metrics)
  if ($null -eq $Metrics) { return $null }
  $label = [string]$Metrics.ModelId -replace '-expires-on-[0-9]*$', ''
  $sess = [string]$Metrics.SessionId
  if ($sess.Length -gt 12) { $sess = $sess.Substring(0, 12) }
  $Metrics | Add-Member -NotePropertyName ModelLabel -NotePropertyValue $label -Force
  $Metrics | Add-Member -NotePropertyName SessionShort -NotePropertyValue $sess -Force
  return $Metrics
}

switch ($Action) {
  'start' { $null = Start-ZmWidget; if (-not $Quiet) { Write-Output 'token meter: window started' } }
  'ensure' { $null = Start-ZmWidget -Auto; }   # silent; used by the SessionStart hook
  'stop' {
    $stopped = Stop-ZmWidget
    if (-not $Quiet) { Write-Output $(if ($stopped) { 'token meter: window closed' } else { 'token meter: window was not running' }) }
  }
  'toggle' {
    $procs = @(Get-ZmWidgetProcess)
    if ($procs.Count -gt 0) { $null = Stop-ZmWidget; if (-not $Quiet) { Write-Output 'token meter: window closed' } }
    else { $null = Start-ZmWidget; if (-not $Quiet) { Write-Output 'token meter: window started' } }
  }
  'status' { Write-Output (Get-ZmStatusLine) }
}

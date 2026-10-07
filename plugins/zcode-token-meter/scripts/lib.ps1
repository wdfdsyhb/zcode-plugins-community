# tokenmeter - shared data layer
# Reads the ZCode local usage database (SQLite, read-only) and the runtime log file
# to produce the metrics shown by the floating widget.
#
# Windows PowerShell 5.1 compatible. No external dependencies (winsqlite3.dll ships with Windows).

$script:ZmHome = if ($env:ZCODE_TOKENMETER_HOME) { $env:ZCODE_TOKENMETER_HOME } else { Join-Path $env:USERPROFILE '.zcode\cli' }

function Get-ZmDbPath { Join-Path $script:ZmHome 'db\db.sqlite' }
function Get-ZmLogDir { Join-Path $script:ZmHome 'log' }
function Get-ZmStateDir {
  $d = Join-Path $env:USERPROFILE '.zcode\tokenmeter'
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  return $d
}
function Get-ZmConfigPath { Join-Path (Get-ZmStateDir) 'config.json' }

# ---------------------------------------------------------------- SQLite access

if (-not ('ZmSqlite' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class ZmSqlite
{
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr vfs);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_close(IntPtr db);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_busy_timeout(IntPtr db, int ms);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int nBytes, out IntPtr stmt, IntPtr tail);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_step(IntPtr stmt);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_finalize(IntPtr stmt);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sqlite3_column_text(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_column_bytes(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_column_count(IntPtr stmt);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sqlite3_errmsg(IntPtr db);

    private const int SQLITE_OK = 0;
    private const int SQLITE_ROW = 100;
    private const int SQLITE_DONE = 101;
    private const int SQLITE_OPEN_READONLY = 1;

    private static string ColText(IntPtr stmt, int i)
    {
        IntPtr p = sqlite3_column_text(stmt, i);
        if (p == IntPtr.Zero) return null;
        int n = sqlite3_column_bytes(stmt, i);
        if (n <= 0) return "";
        byte[] buf = new byte[n];
        Marshal.Copy(p, buf, 0, n);
        return Encoding.UTF8.GetString(buf);
    }

    public static List<string[]> Query(string path, string sql)
    {
        IntPtr db;
        int rc = sqlite3_open_v2(Encoding.UTF8.GetBytes(path + "\0"), out db, SQLITE_OPEN_READONLY, IntPtr.Zero);
        if (rc != SQLITE_OK)
        {
            string msg = db != IntPtr.Zero ? Marshal.PtrToStringAnsi(sqlite3_errmsg(db)) : ("rc=" + rc);
            if (db != IntPtr.Zero) sqlite3_close(db);
            throw new Exception("open: " + msg);
        }
        try
        {
            sqlite3_busy_timeout(db, 3000);
            IntPtr stmt;
            rc = sqlite3_prepare_v2(db, Encoding.UTF8.GetBytes(sql + "\0"), -1, out stmt, IntPtr.Zero);
            if (rc != SQLITE_OK) throw new Exception("prepare rc=" + rc + ": " + Marshal.PtrToStringAnsi(sqlite3_errmsg(db)));
            var rows = new List<string[]>();
            try
            {
                while ((rc = sqlite3_step(stmt)) == SQLITE_ROW)
                {
                    int n = sqlite3_column_count(stmt);
                    var row = new string[n];
                    for (int i = 0; i < n; i++) row[i] = ColText(stmt, i);
                    rows.Add(row);
                }
                if (rc != SQLITE_DONE) throw new Exception("step rc=" + rc + ": " + Marshal.PtrToStringAnsi(sqlite3_errmsg(db)));
            }
            finally { sqlite3_finalize(stmt); }
            return rows;
        }
        finally { sqlite3_close(db); }
    }
}
'@
}

function Invoke-ZmQuery {
  param([Parameter(Mandatory)][string]$Sql)
  $db = Get-ZmDbPath
  # -NoEnumerate keeps the row list intact: a single-row result must stay a
  # list of rows, otherwise PowerShell unwraps it and column indexing breaks.
  if (-not (Test-Path $db)) { Write-Output -NoEnumerate ([System.Collections.Generic.List[string[]]]::new()); return }
  Write-Output -NoEnumerate ([ZmSqlite]::Query($db, $Sql))
}

# ------------------------------------------------------------------- metrics

# Compute the widget metrics for the most recently active session.
function Get-ZmMetrics {
  param([string]$SessionId)

  $db = Get-ZmDbPath
  if (-not (Test-Path $db)) { return $null }

  if (-not $SessionId) {
    $r = Invoke-ZmQuery "select session_id from model_usage where query_source <> 'session_title' group by session_id order by max(started_at) desc limit 1"
    if ($r.Count -eq 0) { return $null }
    $SessionId = $r[0][0]
  }
  if (-not $SessionId) { return $null }
  $sid = $SessionId -replace '[^A-Za-z0-9_\-]', ''

  $rows = Invoke-ZmQuery ("select status, output_tokens, input_tokens, cache_read_input_tokens, cache_creation_input_tokens, duration_ms, time_to_first_token_ms, coalesce(first_token_at,0), coalesce(completed_at,0), model_id from model_usage where session_id = '{0}' and query_source <> 'session_title' order by started_at desc limit 60" -f $sid)

  $speeds = New-Object System.Collections.Generic.List[double]
  $lastSpeed = $null
  $lastOut = 0
  $lastHit = $null
  $modelId = $null
  $lastCompletedMs = 0
  foreach ($row in $rows) {
    $st = $row[0]
    $out = [double]$row[1]
    $inp = [double]$row[2]
    $cr = [double]$row[3]
    $dur = [double]$row[5]
    $fta = [double]$row[7]
    $cpa = [double]$row[8]
    if (-not $modelId) { $modelId = $row[9] }
    if ($cpa -gt $lastCompletedMs) { $lastCompletedMs = [long]$cpa }
    if ($st -ne 'completed' -or $out -le 0) { continue }
    $decodeMs = 0.0
    if ($fta -gt 0 -and $cpa -gt $fta) { $decodeMs = $cpa - $fta } elseif ($dur -gt 0) { $decodeMs = $dur }
    if ($decodeMs -lt 120) { continue }
    $sp = $out / ($decodeMs / 1000.0)
    if ($null -eq $lastSpeed) {
      $lastSpeed = $sp
      $lastOut = [long]$out
      if ($inp -gt 0) { $lastHit = $cr / $inp }
    }
    $speeds.Add($sp)
  }

  $tot = Invoke-ZmQuery ("select count(*), coalesce(sum(output_tokens),0), coalesce(sum(input_tokens),0), coalesce(sum(cache_read_input_tokens),0) from model_usage where session_id = '{0}' and query_source <> 'session_title'" -f $sid)
  $reqCount = 0; $sumOut = 0.0; $sumIn = 0.0; $sumCr = 0.0
  if ($tot.Count -gt 0) {
    $reqCount = [long]$tot[0][0]
    $sumOut = [double]$tot[0][1]
    $sumIn = [double]$tot[0][2]
    $sumCr = [double]$tot[0][3]
  }

  $cacheHit = $null
  if ($sumIn -gt 0) { $cacheHit = $sumCr / $sumIn }

  $arr = $speeds.ToArray()
  [array]::Reverse($arr)

  return [pscustomobject]@{
    SessionId    = $SessionId
    ModelId      = $modelId
    SpeedLast    = $lastSpeed
    LastOut      = $lastOut
    LastHit      = $lastHit
    Speeds       = $arr
    CacheHit     = $cacheHit
    Requests     = $reqCount
    SumOut       = $sumOut
    SumIn        = $sumIn
    SumCacheRead = $sumCr
    LastCompletedMs = $lastCompletedMs
    UpdatedAt    = [DateTime]::Now
  }
}

# --------------------------------------------------------------- live state

# Detects whether a model request is currently streaming, based on the runtime
# log file (model.request.started without a matching completed/failed event).
function Get-ZmLiveState {
  param([string]$SessionId)

  $result = [pscustomobject]@{ Streaming = $false; StartedAtMs = 0 }
  if (-not $SessionId) { return $result }

  $logDir = Get-ZmLogDir
  if (-not (Test-Path $logDir)) { return $result }

  $file = Get-ChildItem -Path $logDir -Filter 'zcode-*.jsonl' -File -ErrorAction SilentlyContinue |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $file) { return $result }

  $text = $null
  try {
    $fs = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      $len = $fs.Length
      $take = [Math]::Min(393216, $len)
      if ($take -le 0) { return $result }
      $fs.Seek(-$take, [System.IO.SeekOrigin]::End) | Out-Null
      $buf = New-Object byte[] $take
      $read = $fs.Read($buf, 0, $take)
      $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)
    } finally { $fs.Dispose() }
  } catch { return $result }

  if (-not $text) { return $result }

  $sidMarker = '"sessionId":"' + $sessionId + '"'
  $lines = $text -split "`n"
  $done = New-Object 'System.Collections.Generic.HashSet[string]'
  $rxEvent = [regex]'"event":"(model\.request\.(?:started|completed|failed))"'
  $rxTrace = [regex]'"traceId":"([^"]+)"'
  $rxTime = [regex]'"timestamp":"([^"]+)"'

  $scanned = 0
  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $l = $lines[$i]
    if ($l.Length -lt 40) { continue }
    if ($l.IndexOf('"event":"model.request.') -lt 0) { continue }
    if ($l.IndexOf($sidMarker) -lt 0) { continue }
    $scanned++
    if ($scanned -gt 400) { break }

    $me = $rxEvent.Match($l)
    if (-not $me.Success) { continue }
    $mt = $rxTrace.Match($l)
    $trace = if ($mt.Success) { $mt.Groups[1].Value } else { $null }

    switch ($me.Groups[1].Value) {
      'model.request.completed' { if ($trace) { [void]$done.Add($trace) } }
      'model.request.failed'    { if ($trace) { [void]$done.Add($trace) } }
      'model.request.started' {
        if ($trace -and $done.Contains($trace)) {
          return $result  # newest request already finished
        }
        $mts = $rxTime.Match($l)
        if ($mts.Success) {
          try { $result.StartedAtMs = [DateTimeOffset]::Parse($mts.Groups[1].Value).ToUnixTimeMilliseconds() } catch { }
        }
        # Staleness guard: an unpaired "started" older than 10 minutes means the
        # runtime exited mid-stream; do not report LIVE forever.
        if ($result.StartedAtMs -gt 0) {
          $ageMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $result.StartedAtMs
          if ($ageMs -gt 600000) { return $result }
        }
        $result.Streaming = $true
        return $result
      }
    }
  }
  return $result
}

# --------------------------------------------------------------- formatting

function Format-ZmSpeed {
  param($Value)
  if ($null -eq $Value) { return '--' }
  $v = [double]$Value
  if ($v -ge 1000) { return ('{0:0.0}k' -f ($v / 1000)) }
  if ($v -ge 100) { return ('{0:0}' -f $v) }
  return ('{0:0.0}' -f $v)
}

function Format-ZmPercent {
  param($Value)
  if ($null -eq $Value) { return '--' }
  $v = [double]$Value * 100.0
  if ($v -ge 99.95) { return '100%' }
  return ('{0:0.0}%' -f $v)
}

function Format-ZmCount {
  param($Value)
  if ($null -eq $Value) { return '--' }
  $v = [double]$Value
  if ($v -ge 1000000) { return ('{0:0.00}M' -f ($v / 1000000)) }
  if ($v -ge 1000) { return ('{0:0.0}k' -f ($v / 1000)) }
  return ('{0:0}' -f $v)
}

# --------------------------------------------------------------- config

function Get-ZmConfig {
  $p = Get-ZmConfigPath
  if (Test-Path $p) {
    try { return (Get-Content $p -Raw | ConvertFrom-Json) } catch { }
  }
  return $null
}

function Save-ZmConfig {
  param($Config)
  $p = Get-ZmConfigPath
  # Merge into the existing file so unrelated keys (AutoStart, ...) survive.
  $merged = [ordered]@{}
  $cur = Get-ZmConfig
  if ($cur) { foreach ($prop in $cur.PSObject.Properties) { $merged[$prop.Name] = $prop.Value } }
  if ($Config) { foreach ($prop in $Config.PSObject.Properties) { $merged[$prop.Name] = $prop.Value } }
  try {
    $json = ([pscustomobject]$merged) | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))
  } catch { }
}

# tokenmeter widget - a small always-on-top window showing
#   1) the output speed of the latest ZCode model response (tokens/second)
#   2) the prompt-cache hit rate (session cumulative)
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File widget.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File widget.ps1 -Snapshot out.png [-Demo] [-Scale 2] [-Backdrop "#20262E"]

param(
  [string]$Snapshot,
  [switch]$Demo,
  [switch]$Auto,          # launched by a ZCode SessionStart hook; respects AutoStart=false
  [switch]$HideConsole,   # launcher passed: hide our own console window ASAP (normally already hidden)
  [double]$Scale = 2,
  [string]$Backdrop = '#20262E'
)

$ErrorActionPreference = 'Stop'

# Win32 helpers: DPI awareness, window styles, and console-window hiding.
if (-not ('ZmDpi' -as [type])) {
  Add-Type -Namespace ZmDpi -Name Api -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
[DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
[DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
}
try { [void][ZmDpi.Api]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch { }   # PER_MONITOR_AWARE_V2

# Belt and braces: hide our own console window right away when the launcher
# asked for it. The normal launch chain already creates the console hidden at
# CreateProcess time; this covers any path that would surface it regardless.
if ($HideConsole) {
  try {
    $con = [ZmDpi.Api]::GetConsoleWindow()
    if ($con -ne [IntPtr]::Zero) { [void][ZmDpi.Api]::ShowWindow($con, 0) }
  } catch { }
}

. (Join-Path $PSScriptRoot 'lib.ps1')

# WPF needs STA; PowerShell 5.1 already is, but re-exec defensively.
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-WindowStyle', 'Hidden', '-File', ('"' + $PSCommandPath + '"'))
  if ($Snapshot) { $argList += @('-Snapshot', ('"' + $Snapshot + '"')) }
  if ($Demo) { $argList += '-Demo' }
  if ($Auto) { $argList += '-Auto' }
  if ($HideConsole) { $argList += '-HideConsole' }
  Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -WindowStyle Hidden | Out-Null
  exit 0
}

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml

function Brush([string]$hex) {
  return [System.Windows.Media.BrushConverter]::new().ConvertFromString($hex)
}

# ------------------------------------------------------------------ window XAML

$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Token Meter"
        Width="280" Height="118"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        ResizeMode="NoResize" ShowInTaskbar="False" ShowActivated="False"
        Topmost="True" SnapsToDevicePixels="True" UseLayoutRounding="True"
        TextOptions.TextFormattingMode="Display"
        FontFamily="Segoe UI Variable Display, Segoe UI">
  <Window.Resources>
    <LinearGradientBrush x:Key="CardBg" StartPoint="0,0" EndPoint="0,1">
      <GradientStop Color="#F0141720" Offset="0"/>
      <GradientStop Color="#F20B0D12" Offset="1"/>
    </LinearGradientBrush>
    <LinearGradientBrush x:Key="FillGreen" StartPoint="0,0" EndPoint="1,0">
      <GradientStop Color="#34D399" Offset="0"/>
      <GradientStop Color="#2BB673" Offset="1"/>
    </LinearGradientBrush>
    <LinearGradientBrush x:Key="AreaGreen" StartPoint="0,0" EndPoint="0,1">
      <GradientStop Color="#6B34D399" Offset="0"/>
      <GradientStop Color="#1F34D399" Offset="1"/>
    </LinearGradientBrush>
    <Style x:Key="DarkMenuItem" TargetType="MenuItem">
      <Setter Property="Foreground" Value="#D7DCE6"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Padding" Value="10,6"/>
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="MenuItem">
            <Border x:Name="Bd" Background="{TemplateBinding Background}" CornerRadius="5" Padding="{TemplateBinding Padding}" SnapsToDevicePixels="True">
              <Grid>
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="Auto"/>
                  <ColumnDefinition Width="*"/>
                </Grid.ColumnDefinitions>
                <TextBlock x:Name="Check" Grid.Column="0" Text="&#x2713;" Visibility="Collapsed" Margin="0,0,7,0" Foreground="#34D399"/>
                <ContentPresenter Grid.Column="1" ContentSource="Header" RecognizesAccessKey="True" VerticalAlignment="Center"/>
              </Grid>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsHighlighted" Value="True">
                <Setter TargetName="Bd" Property="Background" Value="#1FFFFFFF"/>
              </Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="Check" Property="Visibility" Value="Visible"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <ContextMenu x:Key="WidgetMenu" Background="#F21A1E26" BorderBrush="#26FFFFFF" BorderThickness="1" Padding="5" HasDropShadow="True">
      <MenuItem Header="Always on top" IsCheckable="True" IsChecked="True" Style="{StaticResource DarkMenuItem}"/>
      <MenuItem Header="Start with ZCode" IsCheckable="True" IsChecked="True" Style="{StaticResource DarkMenuItem}"/>
      <MenuItem Header="Reset position" Style="{StaticResource DarkMenuItem}"/>
      <Separator/>
      <MenuItem Header="Exit" Style="{StaticResource DarkMenuItem}"/>
    </ContextMenu>
    <Storyboard x:Key="PulseSb" RepeatBehavior="Forever" AutoReverse="True">
      <DoubleAnimation Storyboard.TargetName="Dot" Storyboard.TargetProperty="Opacity" From="1" To="0.3" Duration="0:0:0.9"/>
    </Storyboard>
  </Window.Resources>
  <Grid x:Name="Root">
    <Border x:Name="Card" Margin="12" CornerRadius="14" BorderThickness="1" BorderBrush="#22FFFFFF"
            Background="{StaticResource CardBg}">
      <Border.Effect>
        <DropShadowEffect BlurRadius="16" ShadowDepth="2" Direction="270" Opacity="0.5" Color="#000000"/>
      </Border.Effect>
      <Grid Margin="14,9,14,12">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
        </Grid.RowDefinitions>

        <!-- status row -->
        <DockPanel Grid.Row="0" LastChildFill="False">
          <Ellipse x:Name="Dot" DockPanel.Dock="Left" Width="7" Height="7" Fill="#3F4553" VerticalAlignment="Center"/>
          <TextBlock x:Name="StatusText" DockPanel.Dock="Left" Text="WAITING" Margin="7,0,0,0"
                     FontSize="10" FontWeight="SemiBold" Foreground="#8A93A6" VerticalAlignment="Center"/>
          <TextBlock x:Name="ModelText" DockPanel.Dock="Right" Text="" Margin="10,0,0,0"
                     FontSize="10" Foreground="#5A6373" VerticalAlignment="Center"
                     TextTrimming="CharacterEllipsis" MaxWidth="122" HorizontalAlignment="Right"/>
        </DockPanel>

        <!-- metrics -->
        <Grid Grid.Row="1" Margin="0,6,0,0">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="*"/>
          </Grid.ColumnDefinitions>

          <Grid Grid.Column="0">
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
            </Grid.RowDefinitions>
            <StackPanel Grid.Row="0" Orientation="Horizontal">
              <TextBlock x:Name="SpeedText" Text="--" FontSize="25" FontWeight="SemiBold"
                         Foreground="#F2F5F9" LineStackingStrategy="BlockLineHeight" LineHeight="27"/>
              <TextBlock Text="tok/s" FontSize="9.5" Foreground="#7B8496" Margin="5,0,0,4" VerticalAlignment="Bottom"/>
            </StackPanel>
            <Canvas x:Name="SparkCanvas" Grid.Row="1" Width="101" MinHeight="8" Margin="0,5,0,0"
                    HorizontalAlignment="Left" VerticalAlignment="Stretch">
              <Polygon x:Name="SparkArea" StrokeThickness="0" Fill="{StaticResource AreaGreen}"/>
              <Polyline x:Name="SparkLine" StrokeThickness="1.4" StrokeLineJoin="Round"
                        StrokeStartLineCap="Round" StrokeEndLineCap="Round" Stroke="#34D399"/>
            </Canvas>
          </Grid>

          <Border Grid.Column="1" Width="1" Background="#1FFFFFFF" Margin="11,1,11,1"/>

          <StackPanel Grid.Column="2" VerticalAlignment="Top">
            <StackPanel Orientation="Horizontal">
              <TextBlock x:Name="CacheText" Text="--" FontSize="19" FontWeight="SemiBold"
                         Foreground="#F2F5F9" LineStackingStrategy="BlockLineHeight" LineHeight="27"/>
              <TextBlock Text="cache" FontSize="9.5" Foreground="#7B8496" Margin="5,0,0,3" VerticalAlignment="Bottom"/>
            </StackPanel>
            <Border x:Name="CacheTrack" Height="4" Width="101" CornerRadius="2" Background="#1FFFFFFF"
                    Margin="0,13,0,0" HorizontalAlignment="Left">
              <Border x:Name="CacheFill" Width="0" CornerRadius="2" HorizontalAlignment="Left"
                      Background="{StaticResource FillGreen}"/>
            </Border>
          </StackPanel>
        </Grid>
      </Grid>
    </Border>
  </Grid>
</Window>
'@

$win = [System.Windows.Markup.XamlReader]::Parse($xaml)

# ------------------------------------------------------------------ elements

$script:root        = $win.FindName('Root')
$script:card        = $win.FindName('Card')
$script:dot         = $win.FindName('Dot')
$script:statusText  = $win.FindName('StatusText')
$script:modelText   = $win.FindName('ModelText')
$script:speedText   = $win.FindName('SpeedText')
$script:cacheText   = $win.FindName('CacheText')
$script:cacheTrack  = $win.FindName('CacheTrack')
$script:cacheFill   = $win.FindName('CacheFill')
$script:sparkLine   = $win.FindName('SparkLine')
$script:sparkArea   = $win.FindName('SparkArea')
$script:sparkCanvas = $win.FindName('SparkCanvas')
$script:pulseSb     = $win.Resources['PulseSb']

$script:brushText   = Brush '#F2F5F9'
$script:brushMuted  = Brush '#8A93A6'
$script:brushDim    = Brush '#5A6373'
$script:brushDotOn  = Brush '#34D399'
$script:brushDotOff = Brush '#3F4553'
$script:cacheTrackWidth = [double]$script:cacheTrack.Width
$script:pulsing = $false
$script:win = $win

# ------------------------------------------------------------------ functions

function Format-ZmElapsed {
  param([double]$Seconds)
  if ($Seconds -lt 0) { $Seconds = 0 }
  if ($Seconds -lt 60) { return ('{0:0}s' -f $Seconds) }
  if ($Seconds -lt 3600) { return ('{0:0}m' -f ($Seconds / 60)) }
  return ('{0:0.0}h' -f ($Seconds / 3600))
}

function Set-ZmSpark {
  param($Values)
  $line = $script:sparkLine.Points
  $area = $script:sparkArea.Points
  if ($null -eq $line) { return }
  $line.Clear(); $area.Clear()
  $n = @($Values).Count
  if ($n -lt 2) { return }

  $w = [double]$script:sparkCanvas.Width
  $h = [double]$script:sparkCanvas.ActualHeight   # the canvas stretches to its row
  if (-not ($h -ge 4)) { $h = 18 }                # before the first layout pass
  $max = 0.0
  $min = [double]::MaxValue
  foreach ($v in $Values) {
    if ($v -gt $max) { $max = [double]$v }
    if ($v -lt $min) { $min = [double]$v }
  }
  if ($max -le 0) { return }

  # Relative scale mapped into a compressed band (y 3..h-3) so the whole curve
  # always fits as one continuous line: a slow request would otherwise drag it
  # down to the floor and make the chart read as disconnected spikes. Bands
  # narrower than 8% of the max are padded, so steady speeds stay a calm line
  # instead of being blown up into fake waves.
  $lo = $min; $hi = $max
  $span = $hi - $lo
  if ($span -lt 0.08 * $hi) {
    $pad = (0.08 * $hi - $span) / 2.0
    $lo -= $pad; $hi += $pad; $span = $hi - $lo
  }
  $yTop = 3.0; $yBottom = $h - 3.0

  $pts = New-Object 'System.Collections.Generic.List[System.Windows.Point]'
  for ($i = 0; $i -lt $n; $i++) {
    $x = $w * $i / ($n - 1)
    $norm = if ($span -gt 0) { (([double]$Values[$i]) - $lo) / $span } else { 0.5 }
    if ($norm -lt 0) { $norm = 0 } elseif ($norm -gt 1) { $norm = 1 }
    $y = $yBottom - $norm * ($yBottom - $yTop)
    $pts.Add([System.Windows.Point]::new($x, $y))
  }
  foreach ($p in $pts) { [void]$line.Add($p) }
  [void]$area.Add([System.Windows.Point]::new($pts[0].X, $h))
  foreach ($p in $pts) { [void]$area.Add($p) }
  [void]$area.Add([System.Windows.Point]::new($pts[$pts.Count - 1].X, $h))
}

function Prepare-ZmMetrics {
  param($Metrics)
  if ($null -eq $Metrics) { return $null }
  # Trim noisy suffixes such as "-expires-on-0910" for the tiny label.
  $label = [string]$Metrics.ModelId
  $label = $label -replace '-expires-on-[0-9]*$', ''
  if ($label.Length -gt 26) { $label = $label.Substring(0, 25) + [char]0x2026 }
  $sessShort = [string]$Metrics.SessionId
  if ($sessShort.Length -gt 12) { $sessShort = $sessShort.Substring(0, 12) }
  $Metrics | Add-Member -NotePropertyName ModelLabel -NotePropertyValue $label -Force
  $Metrics | Add-Member -NotePropertyName SessionShort -NotePropertyValue $sessShort -Force
  return $Metrics
}

function Update-ZmUi {
  param($Metrics, $Live)

  if ($null -eq $Metrics) {
    $script:speedText.Text = '--'
    $script:cacheText.Text = '--'
    $script:statusText.Text = 'WAITING'
    $script:statusText.Foreground = $script:brushMuted
    if ($script:pulsing) {
      $script:pulseSb.Stop($script:win)
      $script:dot.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $null)
      $script:pulsing = $false
    }
    $script:dot.Opacity = 1
    $script:dot.Fill = $script:brushDotOff
    $script:modelText.Text = ''
    $script:cacheFill.Width = 0
    Set-ZmSpark @()
    return
  }

  $script:speedText.Text = Format-ZmSpeed $Metrics.SpeedLast
  $vals = @($Metrics.Speeds)
  if ($vals.Count -gt 26) { $vals = $vals[($vals.Count - 26)..($vals.Count - 1)] }
  Set-ZmSpark $vals

  $script:cacheText.Text = Format-ZmPercent $Metrics.CacheHit
  if ($null -ne $Metrics.CacheHit) {
    $w = [Math]::Max(2, [Math]::Round($script:cacheTrackWidth * [Math]::Min(1.0, [double]$Metrics.CacheHit)))
    $script:cacheFill.Width = $w
  } else {
    $script:cacheFill.Width = 0
  }

  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ($Live -and $Live.Streaming -and $Live.StartedAtMs -gt 0) {
    $script:statusText.Text = 'LIVE ' + (Format-ZmElapsed (($nowMs - $Live.StartedAtMs) / 1000.0))
    $script:statusText.Foreground = $script:brushDotOn
    $script:dot.Fill = $script:brushDotOn
    if (-not $script:pulsing) { $script:pulseSb.Begin($script:win, $true); $script:pulsing = $true }
  } else {
    if ($Metrics.LastCompletedMs -gt 0) {
      $script:statusText.Text = 'IDLE ' + (Format-ZmElapsed (($nowMs - $Metrics.LastCompletedMs) / 1000.0))
    } else {
      $script:statusText.Text = 'IDLE'
    }
    $script:statusText.Foreground = $script:brushMuted
    if ($script:pulsing) {
      $script:pulseSb.Stop($script:win)
      $script:dot.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $null)
      $script:pulsing = $false
    }
    $script:dot.Opacity = 1
    $script:dot.Fill = $script:brushDotOff
  }

  $script:modelText.Text = $Metrics.ModelLabel
  $script:card.ToolTip = ("session {0}`n{1} requests · output {2} tokens · cache read {3} / input {4}`nlast response {5} tok/s · {6} tokens · cache hit {7}" -f
      $Metrics.SessionShort, $Metrics.Requests, (Format-ZmCount $Metrics.SumOut), (Format-ZmCount $Metrics.SumCacheRead), (Format-ZmCount $Metrics.SumIn),
      (Format-ZmSpeed $Metrics.SpeedLast), (Format-ZmCount $Metrics.LastOut), (Format-ZmPercent $Metrics.CacheHit))
}

function Save-ZmWidgetConfig {
  Save-ZmConfig ([pscustomobject]@{
      Left    = [Math]::Round($script:win.Left)
      Top     = [Math]::Round($script:win.Top)
      Topmost = [bool]$script:win.Topmost
      Opacity = [double]$script:win.Opacity
    })
}

function New-ZmDemoMetrics {
  $sp = @(212, 227, 233, 228, 219, 236, 241, 238, 229, 224, 231, 246, 252, 248, 239, 233, 228, 236, 244, 249, 253, 247, 238, 232)
  return [pscustomobject]@{
    SessionId       = 'sess_demo_0000'
    ModelId         = 'deepseek-v4.1-flash'
    SpeedLast       = 248.6
    LastOut         = 358
    Speeds          = [double[]]$sp
    CacheHit        = 0.979
    Requests        = 74
    SumOut          = 312500
    SumIn           = 14020000
    SumCacheRead    = 13870000
    LastCompletedMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
}

# ------------------------------------------------------------------ snapshot mode

if ($Snapshot) {
  if ($Demo) {
    $metrics = Prepare-ZmMetrics (New-ZmDemoMetrics)
    $live = [pscustomobject]@{ Streaming = $true; StartedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 12340 }
  } else {
    $metrics = Prepare-ZmMetrics (Get-ZmMetrics)
    $live = if ($metrics) { Get-ZmLiveState -SessionId $metrics.SessionId } else { $null }
  }

  $script:root.Background = Brush $Backdrop
  $w = [double]$win.Width; $h = [double]$win.Height
  # lay out first so the sparkline canvas knows its real height, then draw
  $script:root.Measure([System.Windows.Size]::new($w, $h))
  $script:root.Arrange([System.Windows.Rect]::new(0, 0, $w, $h))
  $script:root.UpdateLayout()

  Update-ZmUi -Metrics $metrics -Live $live

  $script:root.Measure([System.Windows.Size]::new($w, $h))
  $script:root.Arrange([System.Windows.Rect]::new(0, 0, $w, $h))
  $script:root.UpdateLayout()

  $px = [int]($w * $Scale); $py = [int]($h * $Scale)
  $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap -ArgumentList $px, $py, (96 * $Scale), (96 * $Scale), ([System.Windows.Media.PixelFormats]::Pbgra32)
  $rtb.Render($script:root)
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))
  $fs = [System.IO.File]::Create($Snapshot)
  try { $enc.Save($fs) } finally { $fs.Close() }
  Write-Output ("snapshot saved: " + $Snapshot)
  exit 0
}

# ------------------------------------------------------------------ live mode

# launched by hook: skip if the user turned auto-start off
if ($Auto) {
  $cfgAuto = Get-ZmConfig
  if ($cfgAuto -and $cfgAuto.PSObject.Properties['AutoStart'] -and -not [bool]$cfgAuto.AutoStart) { exit 0 }
}

# single instance
$created = $false
$script:mutex = New-Object System.Threading.Mutex($true, 'Local\ZCodeTokenMeterWidget', [ref]$created)
if (-not $created) { exit 0 }

# position + options from config
$cfg = Get-ZmConfig
if ($null -eq $cfg) { $cfg = [pscustomobject]@{} }
$wa = [System.Windows.SystemParameters]::WorkArea
$defLeft = $wa.Right - $win.Width - 18
$defTop = $wa.Top + 18
$wantLeft = if ($cfg.PSObject.Properties['Left']) { [double]$cfg.Left } else { $defLeft }
$wantTop = if ($cfg.PSObject.Properties['Top']) { [double]$cfg.Top } else { $defTop }
# keep at least a grabbable corner inside the work area; the saved position is
# honoured as-is. (SystemParameters.VirtualScreen comes back empty in some launch
# contexts, the work area does not, so the bounds are derived from it.)
if ($wantLeft -lt ($wa.Left - 40) -or $wantLeft -gt ($wa.Right - 60)) { $wantLeft = $defLeft }
if ($wantTop -lt ($wa.Top - 10) -or $wantTop -gt ($wa.Bottom - 40)) { $wantTop = $defTop }
$win.Left = $wantLeft
$win.Top = $wantTop
if ($cfg.PSObject.Properties['Topmost']) { $win.Topmost = [bool]$cfg.Topmost }
if ($cfg.PSObject.Properties['Opacity']) { $win.Opacity = [double]$cfg.Opacity }

# context menu
$script:card.ContextMenu = $win.Resources['WidgetMenu']
$menu = $script:card.ContextMenu
$miTopmost = $menu.Items[0]
$miTopmost.IsChecked = $win.Topmost
$miTopmost.Add_Click({ $script:win.Topmost = $miTopmost.IsChecked; Save-ZmWidgetConfig })
$miAuto = $menu.Items[1]
if ($cfg.PSObject.Properties['AutoStart']) { $miAuto.IsChecked = [bool]$cfg.AutoStart }
$miAuto.Add_Click({ Save-ZmConfig ([pscustomobject]@{ AutoStart = [bool]$miAuto.IsChecked }) })
$menu.Items[2].Add_Click({
    $wa2 = [System.Windows.SystemParameters]::WorkArea
    $script:win.Left = $wa2.Right - $script:win.Width - 18
    $script:win.Top = $wa2.Top + 18
    Save-ZmWidgetConfig
  })
$menu.Items[4].Add_Click({ $script:win.Close() })

# keep it out of Alt+Tab (tool window)
$win.Add_SourceInitialized({
    try {
      $helper = New-Object System.Windows.Interop.WindowInteropHelper($script:win)
      $hwnd = $helper.Handle
      $ex = [ZmDpi.Api]::GetWindowLong($hwnd, -20)
      [void][ZmDpi.Api]::SetWindowLong($hwnd, -20, $ex -bor 0x80)  # WS_EX_TOOLWINDOW
    } catch { }
  })

# drag to move
$script:card.Add_MouseLeftButtonDown({
    param($s, $e)
    try { $script:win.DragMove() } catch { }
    Save-ZmWidgetConfig
  })

# live data loop
$script:timer = New-Object System.Windows.Threading.DispatcherTimer
$script:timer.Interval = [TimeSpan]::FromMilliseconds(700)
$script:timer.Add_Tick({
    $m = $null; $live = $null
    try {
      $m = Prepare-ZmMetrics (Get-ZmMetrics)
      $live = Get-ZmLiveState -SessionId $m.SessionId
    } catch { }
    try { Update-ZmUi -Metrics $m -Live $live } catch { }
    $script:timer.Interval = if ($live -and $live.Streaming) { [TimeSpan]::FromMilliseconds(500) } else { [TimeSpan]::FromMilliseconds(1200) }
  })
$script:timer.Start()

$win.Add_Closed({
    $script:timer.Stop()
    Save-ZmWidgetConfig
    try { $script:mutex.ReleaseMutex() } catch { }
  })

# first paint
$first = $null; $firstLive = $null
try {
  $first = Prepare-ZmMetrics (Get-ZmMetrics)
  $firstLive = Get-ZmLiveState -SessionId $first.SessionId
} catch { }
Update-ZmUi -Metrics $first -Live $firstLive

$win.ShowDialog() | Out-Null

' tokenmeter - hidden launcher / ensure-running helper
'
'   wscript.exe //nologo start-hidden.vbs run      start the widget (manual)
'   wscript.exe //nologo start-hidden.vbs ensure   start it only if the user allows
'                                                  auto-start and it is not running
'                                                  (used by the ZCode SessionStart hook)
'   wscript.exe //nologo start-hidden.vbs spawn [auto]
'                                                  internal second hop (see below)
'
' Launch chain, designed so that NO console window is created at any point:
'   caller (hook or meter.ps1)
'     -> this script, hosted by wscript.exe (GUI subsystem, no console)
'          -> spawns itself again through WMI, so the widget is NOT a child of
'             the caller (ZCode hook processes and their job objects cannot
'             reach it once the session ends)
'               -> inner hop launches powershell with WshShell.Run(..., 0),
'                  i.e. the console is created HIDDEN from the start
'                    -> widget.ps1 (PowerShell + WPF, hidden console, WPF window)

Option Explicit

Dim mode, fso, sh, wmi, here, cfgPath, cfgText, re, procs, p, running, cmd, autoArg
Dim userProfile

mode = "run"
If WScript.Arguments.Count > 0 Then mode = LCase(WScript.Arguments(0))

userProfile = CreateObject("WScript.Shell").ExpandEnvironmentStrings("%USERPROFILE%")
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set re = New RegExp
re.IgnoreCase = True

here = fso.GetParentFolderName(WScript.ScriptFullName)

' --- inner hop: start the widget with a console hidden at creation ---------
If mode = "spawn" Then
  autoArg = ""
  If WScript.Arguments.Count > 1 Then
    If LCase(WScript.Arguments(1)) = "auto" Then autoArg = " -Auto"
  End If
  ' window style 0 = hidden: conhost creates the console window hidden, so
  ' there is no black-window flash. waitOnReturn=False, this host then exits
  ' and the widget keeps running on its own.
  sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & here & "\widget.ps1""" & " -HideConsole" & autoArg, 0, False
  WScript.Quit 0
End If

' --- ensure mode: respect the AutoStart=false setting ----------------------
If mode = "ensure" Then
  cfgPath = userProfile & "\.zcode\tokenmeter\config.json"
  If fso.FileExists(cfgPath) Then
    On Error Resume Next
    cfgText = fso.OpenTextFile(cfgPath, 1).ReadAll
    On Error GoTo 0
    If Len(cfgText) > 0 Then
      re.Pattern = """autostart""\s*:\s*false"
      If re.Test(cfgText) Then WScript.Quit 0
    End If
  End If
End If

' --- already running? ------------------------------------------------------
' Match "-File ...widget.ps1" so a shell one-liner that merely mentions the
' file name is not mistaken for a running widget.
running = False
On Error Resume Next
Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='powershell.exe'")
If Err.Number = 0 Then
  For Each p In procs
    If Not IsNull(p.CommandLine) Then
      re.Pattern = "-File\s+"".*widget\.ps1"""
      If re.Test(p.CommandLine) Then running = True
    End If
  Next
End If
On Error GoTo 0
If running Then WScript.Quit 0

' --- detach through WMI, then let the inner hop do the hidden start --------
autoArg = ""
If mode = "ensure" Then autoArg = " auto"
cmd = "wscript.exe //nologo """ & WScript.ScriptFullName & """ spawn" & autoArg
On Error Resume Next
wmi.Get("Win32_Process").Create cmd
On Error GoTo 0

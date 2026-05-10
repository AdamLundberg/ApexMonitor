Dim fso, exePath
Set fso = CreateObject("Scripting.FileSystemObject")
exePath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "apex-monitor.exe")
If fso.FileExists(exePath) Then
    CreateObject("WScript.Shell").Run Chr(34) & exePath & Chr(34), 0, False
Else
    MsgBox "Cannot find apex-monitor.exe next to this script." & vbCrLf & "Expected: " & exePath, 16, "Apex Monitor"
End If

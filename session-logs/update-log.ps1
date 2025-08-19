function Add-SessionLogEntry {
    param(
        [string]$Type,
        [string]$Action,
        [string]$Result,
        [string]$Details = ""
    )
    
    $timestamp = Get-Date -Format "HH:mm"
    $date = Get-Date -Format "yyyy-MM-dd"
    $logFile = Get-ChildItem "session-logs\session-$date-*.md" | Select-Object -Last 1
    
    if ($logFile) {
        $entryText = "`n`n### [$timestamp] $Type - $Action`n"
        $entryText += "**Result**: $Result`n"
        if ($Details) {
            $entryText += "**Details**: $Details`n"
        }
        $entryText += "---"
        
        Add-Content -Path $logFile.FullName -Value $entryText
        Write-Host "✅ Log updated: $Action" -ForegroundColor Green
    }
}
Write-Host "🔍 CHECKING CRITICAL CONFIGURATIONS..." -ForegroundColor Yellow
Write-Host ""

$missing = @()

# Check .env.local
if (Test-Path ".env.local") {
    $env = Get-Content .env.local
    
    # Check for Resend
    if ($env -notmatch "RESEND") {
        $missing += "❌ Resend configuration"
    } else {
        Write-Host "✅ Resend configured" -ForegroundColor Green
    }
    
    # Check for Trullo
    if ($env -notmatch "TRULLO") {
        $missing += "❌ Trullo chatbot configuration"
    } else {
        Write-Host "✅ Trullo configured" -ForegroundColor Green
    }
    
    # Check for Firebase
    if ($env -match "FIREBASE") {
        Write-Host "✅ Firebase configured" -ForegroundColor Green
    } else {
        $missing += "❌ Firebase configuration"
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`n⚠️ MISSING CONFIGURATIONS:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host $_ }
}

Write-Host "`n📁 Checking for email templates..." -ForegroundColor Yellow
$templates = Get-ChildItem -Recurse -Include "*template*","*email*.html" -File 2>$null
if ($templates) {
    Write-Host "✅ Found $($templates.Count) template files" -ForegroundColor Green
} else {
    Write-Host "❌ No email templates found" -ForegroundColor Red
}
# Run as Administrator: right-click PowerShell -> Run as administrator, then:
#   Set-ExecutionPolicy -Scope Process Bypass; .\scripts\allow-lan-access.ps1

$ErrorActionPreference = "Stop"

$rules = @(
  @{ Name = "MESMS Frontend Vite 8080"; Port = 8080 },
  @{ Name = "MESMS Backend API 4000"; Port = 4000 }
)

foreach ($r in $rules) {
  Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule `
    -DisplayName $r.Name `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $r.Port `
    -Action Allow `
    -Profile Any `
    -Enabled True | Out-Null
  Write-Host "Allowed inbound TCP $($r.Port) ($($r.Name))"
}

try {
  Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
  Write-Host "Wi-Fi network category set to Private"
} catch {
  Write-Host "Could not set Wi-Fi to Private (may need manual change in Settings): $($_.Exception.Message)"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq "Wi-Fi" -and $_.IPAddress -like "192.168.*" }).IPAddress
Write-Host ""
Write-Host "Open on your phone (same Wi-Fi): http://${ip}:8080/"
Write-Host "Done."

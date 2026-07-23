$f = "d:\prasanna\HRMS- Subscription\HRMS-Subscription\FRONTEND\src\pages\Payroll.jsx"
$lines = [System.IO.File]::ReadAllLines($f)
Write-Host "Total lines: $($lines.Length)"
# Keep lines 0..1896 (0-indexed = lines 1-1897) + lines 2182.. (0-indexed = lines 2183+)
$new = $lines[0..1896] + $lines[2182..($lines.Length-1)]
Write-Host "New total: $($new.Length)"
[System.IO.File]::WriteAllLines($f, $new)
Write-Host "Done."

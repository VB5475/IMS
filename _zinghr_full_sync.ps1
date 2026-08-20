$ErrorActionPreference = "Stop"
$SCRATCH = "C:\Users\ADMINI~1\AppData\Local\Temp\claude\d--Hardik-Shah-CAI-Projects-IMS\9b86d445-2bbc-48c0-ac9c-e6f00d56604c\scratchpad"
$ZingUrl = "https://portal.zinghr.com/2015/route/EmployeeDetails/GetEmployeeMasterDetails"
$ZingToken = "c94e40b60ee24e36a35b47796dec2c9d"
$SaveUrl = "http://122.179.135.100:8095/IMS_LIVE/API/GenUserMst/Post_RB_GenUserMst_Save"

# Already-added EmployeeIDs from earlier steps (10 from the sample-doc batch,
# 5 from the pipeline validation test) — skip these, don't duplicate them.
$alreadyAdded = @("33444","33446","33441","33448","33447","33443","33442","33439","33440","33445","35374","33855","34516","33458","34030")

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "$ts $msg"
}

# ── 1. Fetch all employees from ZingHR (paginated) ──────────────────────
Log "Fetching all employees from ZingHR..."
$allEmployees = @{}
$pageNumber = 1
$total = [int]::MaxValue
while ($allEmployees.Count -lt $total -and $pageNumber -le 20) {
    $reqBody = @{
        SubscriptionName = "IMSPLGROUP"
        Token = $ZingToken
        Fromdate = "01-05-2022"
        ToDate = "10-05-2022"
        PageSize = 2000
        PageNumber = $pageNumber
    } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod -Uri $ZingUrl -Method Post -ContentType "application/json" -Body $reqBody -TimeoutSec 90
    $total = [int]$resp.TotalEmployeeCount
    if (-not $resp.Employees -or $resp.Employees.Count -eq 0) { break }
    foreach ($e in $resp.Employees) { $allEmployees[$e.EmployeeID] = $e }
    Log "ZingHR page $pageNumber : got $($resp.Employees.Count), running total $($allEmployees.Count)/$total"
    $pageNumber++
}
Log "Fetched $($allEmployees.Count) unique employees from ZingHR."

$toSync = $allEmployees.Values | Where-Object { $alreadyAdded -notcontains $_.EmployeeID }
Log "Employees to sync (excluding $($alreadyAdded.Count) already added): $($toSync.Count)"

# ── 2. Sync each remaining employee into IMS User Master ────────────────
$results = New-Object System.Collections.Generic.List[object]
$successCount = 0
$failCount = 0
$i = 0

foreach ($emp in $toSync) {
    $i++
    $userId = ("e" + $emp.EmployeeID)
    if ($userId.Length -gt 10) { $userId = $userId.Substring(0, 10) }
    $username = ($emp.EmployeeName -replace '\s+', ' ').Trim()

    $row = @{
        idnumber = 0; desgid = 1; userid = $userId; username = $username
        pwd = "Test@12345"; groupid = 10171; email = [string]$emp.Email; deptid = 1
        isadminuser = 0; isdivisionhead = 0; isdepthead = 0; locationid = 47
        logdate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss"); loginid = 1; sessionid = 88; yearid = 2
        compuniquekey = ""; entrystatus = 0; funccode = "rb_genusermst"; verifypwd = "Test@12345"
    }
    $mstJson = ConvertTo-Json @($row) -Compress
    $payload = @{
        prmStrMstJSON = $mstJson; prmStrDetJSON = "[]"
        prmYearID = 2; prmLoginID = 1; prmDivisionID = 0; prmMode = "A"; prmIPAddress = ""; prmOtherInfo = ""
    } | ConvertTo-Json -Compress

    $attempt = 1
    $done = $false
    while (-not $done -and $attempt -le 2) {
        try {
            $resp = Invoke-RestMethod -Uri $SaveUrl -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 30
            $entry = if ($resp -is [array]) { $resp[0] } else { $resp }
            if ([string]$entry.ErrCode -eq "1") {
                $idMatch = [regex]::Match([string]$entry.ErrMsg, 'ID\[\s*(\d+)\s*\]')
                $newId = if ($idMatch.Success) { $idMatch.Groups[1].Value } else { $null }
                $results.Add([PSCustomObject]@{ employeeId = $emp.EmployeeID; name = $username; userid = $userId; success = $true; id = $newId; reason = $null })
                $successCount++
            } else {
                $results.Add([PSCustomObject]@{ employeeId = $emp.EmployeeID; name = $username; userid = $userId; success = $false; id = $null; reason = [string]$entry.ErrMsg })
                $failCount++
            }
            $done = $true
        } catch {
            if ($attempt -eq 2) {
                $results.Add([PSCustomObject]@{ employeeId = $emp.EmployeeID; name = $username; userid = $userId; success = $false; id = $null; reason = "Network/script error: $($_.Exception.Message)" })
                $failCount++
                $done = $true
            } else {
                Start-Sleep -Milliseconds 1000
            }
            $attempt++
        }
    }

    if ($i % 250 -eq 0 -or $i -eq $toSync.Count) {
        Log "Progress: $i/$($toSync.Count) processed, $successCount succeeded, $failCount failed"
        $results | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "$SCRATCH\zinghr_sync_results.json"
    }
}

$results | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "$SCRATCH\zinghr_sync_results.json"

Log "=== FINAL SUMMARY ==="
Log "Total processed: $($results.Count)"
Log "Success count: $successCount"
Log "Failed count: $failCount"

$reasonGroups = $results | Where-Object { -not $_.success } | Group-Object reason | Sort-Object Count -Descending
foreach ($g in $reasonGroups) {
    Log "Failure reason ($($g.Count)x): $($g.Name)"
}

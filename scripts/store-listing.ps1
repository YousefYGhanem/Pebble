# The Store listing (Pebble Pet) from docs/store/listing.json and docs/store/*.png, through the Microsoft Store
# submission API: copies the live submission, replaces each English and Arabic listing's text and screenshots, uploads
# the pictures and submits it for certification. Run by the "Store listing" workflow, with the PARTNER_CENTER_* secrets.
$ErrorActionPreference = 'Stop'
$app = '9PJNR7CT4ZN7'
$api = "https://manage.devcenter.microsoft.com/v1.0/my/applications/$app"
$data = Get-Content -Raw -Encoding utf8 docs/store/listing.json | ConvertFrom-Json

$token = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$env:PARTNER_CENTER_TENANT_ID/oauth2/token" -Body @{
  grant_type = 'client_credentials'; client_id = $env:PARTNER_CENTER_CLIENT_ID; client_secret = $env:PARTNER_CENTER_CLIENT_SECRET
  resource = 'https://manage.devcenter.microsoft.com' }).access_token
$auth = @{ Authorization = "Bearer $token" }
function Send($method, $uri, $body) {
  $json = $null # assigned, not returned from an if: PowerShell would turn the bytes into a list of numbers
  if ($null -ne $body) { $json = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 30)) }
  Invoke-RestMethod -Method $method -Uri $uri -Headers $auth -ContentType 'application/json; charset=utf-8' -Body $json
}

# a submission already waiting (a release's upload, or one started in Partner Center) is never replaced, except the one
# named in STORE_DISCARD (a draft an earlier run of this left behind)
$current = Send Get $api
if ($current.pendingApplicationSubmission -and $current.pendingApplicationSubmission.id -eq $env:STORE_DISCARD) {
  Send Delete "$api/submissions/$env:STORE_DISCARD" | Out-Null
  Write-Host "Draft $env:STORE_DISCARD discarded"
  $current = Send Get $api
}
if ($current.pendingApplicationSubmission) { throw "A submission is already pending ($($current.pendingApplicationSubmission.id)): wait until it is published, then run this again." }

$sub = Send Post "$api/submissions"
Write-Host "Submission $($sub.id) created"
# the Arabic page, when the Store has none yet (the app itself is in English and Arabic)
if (-not ($sub.listings.PSObject.Properties.Name -like 'ar*')) {
  $en = $sub.listings.PSObject.Properties | Where-Object Name -like 'en*' | Select-Object -First 1
  $ar = $en.Value | ConvertTo-Json -Depth 30 | ConvertFrom-Json
  $ar.baseListing.images = @() # its screenshots are added below; English's pictures belong to English
  $sub.listings | Add-Member -NotePropertyName 'ar' -NotePropertyValue $ar
}
foreach ($lang in $sub.listings.PSObject.Properties.Name) {
  $words = if ($lang -like 'ar*') { $data.ar } elseif ($lang -like 'en*') { $data.en } else { $null }
  if (-not $words) { Write-Host "Listing $lang left as it is"; continue }
  $base = $sub.listings.$lang.baseListing
  $base.description = $words.description
  $base.features = @($words.features)
  $base.keywords = @($words.keywords)
  $base.releaseNotes = $words.releaseNotes
  # the old screenshots go, the new ones come in order; other pictures (logos) stay
  $images = @(foreach ($i in @($base.images | Where-Object { $_ })) { if ($i.imageType -eq 'Screenshot') { $i.fileStatus = 'PendingDelete' }; $i })
  for ($n = 0; $n -lt $data.screenshots.Count; $n++) {
    $images += [pscustomobject]@{ fileName = $data.screenshots[$n]; fileStatus = 'PendingUpload'; imageType = 'Screenshot'; description = $words.screenshots[$n] }
  }
  $base.images = $images
  Write-Host "Listing $lang updated"
}

$zip = Join-Path $env:RUNNER_TEMP 'listing.zip'
Compress-Archive -Force -DestinationPath $zip -Path ($data.screenshots | ForEach-Object { "docs/store/$_" })
Invoke-RestMethod -Method Put -Uri $sub.fileUploadUrl -InFile $zip -Headers @{ 'x-ms-blob-type' = 'BlockBlob' } | Out-Null
$null = Send Put "$api/submissions/$($sub.id)" $sub
$null = Send Post "$api/submissions/$($sub.id)/commit"

# committing is checked (a few minutes); certification then takes Microsoft a few days
for ($t = 0; $t -lt 60; $t++) {
  Start-Sleep 10
  $s = Send Get "$api/submissions/$($sub.id)/status"
  if ($s.status -ne 'CommitStarted') { break }
}
Write-Host "Status: $($s.status)"
if ($s.status -like '*Failed') { $s.statusDetails | ConvertTo-Json -Depth 10 | Write-Host; exit 1 }

<#
Hanoi City: check this Windows machine and say which engine to build with (UE 5.8 or Unity 6).
Prints key=value facts, then recommendation=... and a short Vietnamese explanation.
Thresholds and rules: docs/14-chon-engine.md. The macOS/Linux twin is tools/check_machine.sh
(same thresholds, test-enforced by tests/test_check_machine.py).

  powershell -ExecutionPolicy Bypass -File tools\check_machine.ps1
  powershell -ExecutionPolicy Bypass -File tools\check_machine.ps1 -Facts facts.txt   # decide from key=value
  powershell -ExecutionPolicy Bypass -File tools\check_machine.ps1 -Disk D:\          # where the repo/engine will live

Runs on Windows PowerShell 5.1 and PowerShell 7. Reads only; installs nothing.
#>
param(
    [string]$Facts = "",
    [string]$Disk = ""
)
$ErrorActionPreference = "SilentlyContinue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- thresholds (keep identical to check_machine.sh) ---
$UE_MIN_RAM_GB=32;  $UE_REC_RAM_GB=64
$UE_MIN_VRAM_GB=8;  $UE_REC_VRAM_GB=12
$UE_MIN_DISK_GB=150; $UE_REC_DISK_GB=300
$UE_MIN_CORES=6;    $UE_REC_CORES=8
$UE_MAC_MIN_RAM_GB=64
$UNITY_MIN_RAM_GB=16; $UNITY_REC_RAM_GB=32
$UNITY_MIN_VRAM_GB=6; $UNITY_REC_VRAM_GB=8
$UNITY_MIN_DISK_GB=60; $UNITY_REC_DISK_GB=120
$UNITY_MIN_CORES=4
$URP_MIN_RAM_GB=16; $URP_MIN_DISK_GB=60
# --- end thresholds ---

$f = [ordered]@{
    os = "windows"; os_version = ""; cpu = ""; cores = 0; threads = 0; ram_gb = 0; gpu = ""; vram_gb = 0
    gpu_api = "unknown"; apple_silicon = "no"; disk_path = ""; disk_free_gb = 0; disk_ssd = "unknown"
    ue_installed = "no"; unity_installed = "no"; vs_installed = "no"; drives = ""
}

function To-GB([double]$bytes) { return [int][math]::Round($bytes / 1GB) }

if ($Facts -ne "") {
    foreach ($line in Get-Content -LiteralPath $Facts -Encoding UTF8) {
        $i = $line.IndexOf("=")
        if ($i -lt 1) { continue }
        $k = $line.Substring(0, $i).Trim(); $v = $line.Substring($i + 1).Trim()
        if ($f.Contains($k)) { $f[$k] = $v }
    }
} else {
    if ($Disk -eq "") { $Disk = Split-Path -Parent $PSScriptRoot }
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $f.os_version = "$($osInfo.Caption) $($osInfo.Version)".Trim()
    $procs = @(Get-CimInstance Win32_Processor)
    $f.cpu = ($procs | Select-Object -First 1).Name.Trim()
    $f.cores = ($procs | Measure-Object -Property NumberOfCores -Sum).Sum
    $f.threads = ($procs | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
    $f.ram_gb = To-GB (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory

    # VRAM: Win32_VideoController.AdapterRAM is a uint32 (caps at 4 GB), so read the driver's 64-bit value.
    $best = $null; $bestBytes = 0
    $classKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
    foreach ($k in Get-ChildItem $classKey) {
        $p = Get-ItemProperty $k.PSPath
        $bytes = 0
        if ($p."HardwareInformation.qwMemorySize") { $bytes = [double]$p."HardwareInformation.qwMemorySize" }
        elseif ($p."HardwareInformation.MemorySize" -is [byte[]]) { $bytes = [double][BitConverter]::ToUInt32($p."HardwareInformation.MemorySize", 0) }
        elseif ($p."HardwareInformation.MemorySize") { $bytes = [double]$p."HardwareInformation.MemorySize" }
        if ($bytes -gt $bestBytes -and $p.DriverDesc) { $bestBytes = $bytes; $best = $p.DriverDesc }
    }
    $nvsmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if ($nvsmi) {
        $line = (& nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits | Select-Object -First 1)
        if ($line) {
            $parts = $line.Split(",")
            $mb = [double]($parts[1].Trim())
            if ($mb * 1MB -gt $bestBytes) { $bestBytes = $mb * 1MB; $best = $parts[0].Trim() }
        }
    }
    if (-not $best) {
        $vc = Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1
        $best = $vc.Name; $bestBytes = [double]$vc.AdapterRAM
    }
    $f.gpu = "$best"
    $f.vram_gb = To-GB $bestBytes
    $f.gpu_api = "dx12"  # every GPU on Windows 10/11 with a WDDM 2 driver; feature level 12_1/SM6 needs RTX 20+ / RX 6000+ / Arc

    $f.disk_path = $Disk
    $letter = (Split-Path -Qualifier (Resolve-Path $Disk)).TrimEnd(":")
    $drive = Get-PSDrive -Name $letter
    $f.disk_free_gb = [int][math]::Floor($drive.Free / 1GB)
    $part = Get-Partition -DriveLetter $letter
    if ($part) {
        $pd = Get-PhysicalDisk | Where-Object { $_.DeviceId -eq "$($part.DiskNumber)" } | Select-Object -First 1
        if ($pd.MediaType -eq "SSD") { $f.disk_ssd = "yes" } elseif ($pd.MediaType -eq "HDD") { $f.disk_ssd = "no" }
    }
    $f.drives = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -ne $null } |
        ForEach-Object { "$($_.Name): $([int][math]::Floor($_.Free / 1GB))GB free" }) -join "; "

    if (Test-Path "C:\Program Files\Epic Games\UE_5.*") { $f.ue_installed = "yes" }
    if (Test-Path "C:\Program Files\Unity\Hub\Editor") { $f.unity_installed = "yes" }
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) { if (& $vswhere -latest -property installationVersion) { $f.vs_installed = "yes" } }
}

# Not $disk: PowerShell names are case-insensitive and the -Disk parameter is a [string].
$ram = [int]$f.ram_gb; $vram = [int]$f.vram_gb; $diskGb = [int]$f.disk_free_gb; $cores = [int]$f.cores

# --- decision (keep identical to check_machine.sh) ---
$ueFail = @()
if ($ram -lt $UE_MIN_RAM_GB) { $ueFail += "RAM ${ram}<${UE_MIN_RAM_GB}GB" }
if ($vram -lt $UE_MIN_VRAM_GB) { $ueFail += "VRAM ${vram}<${UE_MIN_VRAM_GB}GB" }
if ($diskGb -lt $UE_MIN_DISK_GB) { $ueFail += "disk ${diskGb}<${UE_MIN_DISK_GB}GB" }
if ($cores -lt $UE_MIN_CORES) { $ueFail += "cores ${cores}<${UE_MIN_CORES}" }
if ($f.disk_ssd -eq "no") { $ueFail += "disk is HDD" }
if ($f.os -eq "macos" -and $ram -lt $UE_MAC_MIN_RAM_GB) { $ueFail += "Mac RAM ${ram}<${UE_MAC_MIN_RAM_GB}GB" }
if ($f.os -eq "macos" -and $f.apple_silicon -ne "yes") { $ueFail += "Intel Mac" }

$unityFail = @()
if ($ram -lt $UNITY_MIN_RAM_GB) { $unityFail += "RAM ${ram}<${UNITY_MIN_RAM_GB}GB" }
if ($vram -lt $UNITY_MIN_VRAM_GB) { $unityFail += "VRAM ${vram}<${UNITY_MIN_VRAM_GB}GB" }
if ($diskGb -lt $UNITY_MIN_DISK_GB) { $unityFail += "disk ${diskGb}<${UNITY_MIN_DISK_GB}GB" }
if ($cores -lt $UNITY_MIN_CORES) { $unityFail += "cores ${cores}<${UNITY_MIN_CORES}" }

if ($ueFail.Count -eq 0) {
    $recommendation = "ue5"
    if ($ram -ge $UE_REC_RAM_GB -and $vram -ge $UE_REC_VRAM_GB -and $diskGb -ge $UE_REC_DISK_GB -and $cores -ge $UE_REC_CORES) { $tier = "recommended" } else { $tier = "minimum" }
} elseif ($unityFail.Count -eq 0) {
    $recommendation = "unity_hdrp"
    if ($ram -ge $UNITY_REC_RAM_GB -and $vram -ge $UNITY_REC_VRAM_GB -and $diskGb -ge $UNITY_REC_DISK_GB) { $tier = "recommended" } else { $tier = "minimum" }
} elseif ($ram -ge $URP_MIN_RAM_GB -and $diskGb -ge $URP_MIN_DISK_GB) {
    $recommendation = "unity_urp"; $tier = "minimum"
} else {
    $recommendation = "none"; $tier = "none"
}
# --- end decision ---

foreach ($k in $f.Keys) { Write-Output "$k=$($f[$k])" }
Write-Output "ue_blockers=$($ueFail -join '; ')"
Write-Output "unity_blockers=$($unityFail -join '; ')"
Write-Output "recommendation=$recommendation"
Write-Output "tier=$tier"
Write-Output ""
$ueWhy = $ueFail -join "; "; $unityWhy = $unityFail -join "; "
switch ($recommendation) {
    "ue5" { Write-Output "Khuyến nghị: Unreal Engine 5.8 (mức $tier). Làm theo docs/05-tich-hop-ue5.md." }
    "unity_hdrp" { Write-Output "Khuyến nghị: Unity 6 HDRP (mức $tier). UE 5.8 chưa đủ vì: $ueWhy. Làm theo docs/13-tich-hop-unity.md." }
    "unity_urp" { Write-Output "Khuyến nghị: Unity 6 nhưng dùng URP (GPU yếu). Thiếu cho HDRP: $unityWhy. Xem docs/14-chon-engine.md mục 5." }
    "none" { Write-Output "Máy này chưa đủ để dựng Hà Nội trong engine nào: $unityWhy. Tiếp tục phần không cần engine, hoặc thuê máy trạm đám mây (docs/14-chon-engine.md mục 6)." }
}
if ($diskGb -lt $UE_MIN_DISK_GB -and $f.drives) { Write-Output "Ổ đĩa: $($f.drives). Chạy lại với -Disk <ổ trống nhất> nếu định đặt repo và engine ở đó." }

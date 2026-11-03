# Generates the Gege Downloader logo and all icon variants from scratch (no image libs needed).
param([string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)

Add-Type -AssemblyName System.Drawing

$dark  = [System.Drawing.Color]::FromArgb(255, 0x14, 0x18, 0x1a)
$g1    = [System.Drawing.Color]::FromArgb(255, 0x22, 0xc5, 0x5e)
$g2    = [System.Drawing.Color]::FromArgb(255, 0x14, 0xb8, 0xa6)
$white = [System.Drawing.Color]::White

function New-RoundedRectPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r*2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x+$w-$d, $y, $d, $d, 270, 90)
  $p.AddArc($x+$w-$d, $y+$h-$d, $d, $d, 0, 90)
  $p.AddArc($x, $y+$h-$d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Draw-Logo([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded-square background
  $radius = $size * 0.22
  $bgPath = New-RoundedRectPath 0 0 $size $size $radius
  $bgBrush = New-Object System.Drawing.SolidBrush($dark)
  $g.FillPath($bgBrush, $bgPath)

  # G mark
  $inset = $size * 0.16
  $box = $size - 2*$inset
  $cx = $size/2.0
  $cy = $size/2.0
  $stroke = $size * 0.16
  $gRect = New-Object System.Drawing.RectangleF($inset, $inset, $box, $box)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($gRect, $g1, $g2, 45.0)
  $pen = New-Object System.Drawing.Pen($grad, $stroke)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  # Arc: 270-degree sweep, opening on the right
  $g.DrawArc($pen, $inset, $inset, $box, $box, 45, 270)
  # Horizontal bar from center to right edge
  $barY = $cy
  $barX1 = $cx
  $barX2 = $inset + $box
  $g.DrawLine($pen, $barX1, $barY, $barX2, $barY)

  # White download arrow inside the opening
  $aw = $size * 0.16
  $ah = $size * 0.20
  $ax = $cx + $size*0.06
  $ay = $cy + $size*0.02
  $pts = New-Object System.Drawing.PointF[] 3
  $pts[0] = New-Object System.Drawing.PointF($ax, $ay)
  $pts[1] = New-Object System.Drawing.PointF(($ax+$aw), $ay)
  $pts[2] = New-Object System.Drawing.PointF(($ax+$aw/2), ($ay+$ah))
  $arrowBrush = New-Object System.Drawing.SolidBrush($white)
  $g.FillPolygon($arrowBrush, $pts)

  $bgBrush.Dispose(); $bgPath.Dispose(); $pen.Dispose(); $grad.Dispose(); $arrowBrush.Dispose(); $g.Dispose()
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# Source logo (1024)
$logo = Draw-Logo 1024
Save-Png $logo (Join-Path $Root 'branding\logo.png')
$logo.Dispose()

# App icon (1024) + resources (512)
$appIcon = Draw-Logo 1024
Save-Png $appIcon (Join-Path $Root 'build\icon.png')
$appIcon.Dispose()
$tray = Draw-Logo 512
Save-Png $tray (Join-Path $Root 'resources\icon-dark.png')
$tray.Dispose()

# Extension icons
foreach ($s in 16,32,48,128) {
  $b = Draw-Logo $s
  Save-Png $b (Join-Path $Root "extension\icons\icon-$s.png")
  $b.Dispose()
}

# Build multi-size ICO
$sizes = @(16,24,32,48,64,128,256)
$pngBytesList = @()
foreach ($s in $sizes) {
  $b = Draw-Logo $s
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytesList += ,($ms.ToArray())
  $ms.Dispose(); $b.Dispose()
}

$icoPath = Join-Path $Root 'build\icon.ico'
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
# ICONDIR
$bw.Write([uint16]0)   # reserved
$bw.Write([uint16]1)   # type: icon
$bw.Write([uint16]$sizes.Count)
# Calculate offsets
$offset = 6 + 16*$sizes.Count
$entries = @()
foreach ($i in 0..($sizes.Count-1)) {
  $s = $sizes[$i]
  $w = if ($s -ge 256) { 0 } else { $s }
  $h = $w
  $entries += @{ size=$s; w=$w; h=$h; bytes=$pngBytesList[$i].Length; offset=$offset }
  $offset += $pngBytesList[$i].Length
}
foreach ($e in $entries) {
  $bw.Write([byte]$e.w)
  $bw.Write([byte]$e.h)
  $bw.Write([byte]0)   # color count
  $bw.Write([byte]0)   # reserved
  $bw.Write([uint16]1) # planes
  $bw.Write([uint16]32) # bit count
  $bw.Write([uint32]$e.bytes)
  $bw.Write([uint32]$e.offset)
}
foreach ($e in $entries) {
  $bw.Write($pngBytesList[$entries.IndexOf($e)])
}
$bw.Flush(); $bw.Close(); $fs.Close()
Write-Host "Generated logo + icons"
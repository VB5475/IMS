Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] data, int count, out int written);
}
"@

$printer = "TSC TA200"
$file = "C:\Users\V B\Desktop\vbprint.prn"

$data = [System.IO.File]::ReadAllBytes($file)

$h = [IntPtr]::Zero
[RawPrinterHelper]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero) | Out-Null

$doc = New-Object RawPrinterHelper+DOCINFO
$doc.pDocName = "Label"
$doc.pDataType = "RAW"

[RawPrinterHelper]::StartDocPrinter($h, 1, $doc) | Out-Null
[RawPrinterHelper]::StartPagePrinter($h) | Out-Null

$written = 0
[RawPrinterHelper]::WritePrinter($h, $data, $data.Length, [ref]$written) | Out-Null

[RawPrinterHelper]::EndPagePrinter($h) | Out-Null
[RawPrinterHelper]::EndDocPrinter($h) | Out-Null
[RawPrinterHelper]::ClosePrinter($h) | Out-Null

Write-Host "Printed $written bytes."
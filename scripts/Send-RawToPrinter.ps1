param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("list", "print")]
    [string]$Action,

    [string]$Printer = "",
    [string]$DataBase64 = ""
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] data, int count, out int written);
}
"@

function Send-RawBytes {
    param(
        [string]$PrinterName,
        [byte[]]$Bytes
    )

    $h = [IntPtr]::Zero
    if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$h, [IntPtr]::Zero)) {
        throw "Cannot open printer '$PrinterName'."
    }

    try {
        $doc = New-Object RawPrinterHelper+DOCINFO
        $doc.pDocName = "IMS Sticker"
        $doc.pDataType = "RAW"

        if (-not [RawPrinterHelper]::StartDocPrinter($h, 1, $doc)) {
            throw "StartDocPrinter failed for '$PrinterName'."
        }

        try {
            if (-not [RawPrinterHelper]::StartPagePrinter($h)) {
                throw "StartPagePrinter failed."
            }

            $written = 0
            if (-not [RawPrinterHelper]::WritePrinter($h, $Bytes, $Bytes.Length, [ref]$written)) {
                throw "WritePrinter failed."
            }

            [RawPrinterHelper]::EndPagePrinter($h) | Out-Null
            Write-Output $written
        }
        finally {
            [RawPrinterHelper]::EndDocPrinter($h) | Out-Null
        }
    }
    finally {
        [RawPrinterHelper]::ClosePrinter($h) | Out-Null
    }
}

if ($Action -eq "list") {
    $names = @(Get-Printer | Select-Object -ExpandProperty Name)
    $names | ConvertTo-Json -Compress
    exit 0
}

if ($Action -eq "print") {
    if (-not $Printer) { throw "Printer name is required." }
    if (-not $DataBase64) { throw "Print data is required." }

    $bytes = [Convert]::FromBase64String($DataBase64)
    $written = Send-RawBytes -PrinterName $Printer -Bytes $bytes
    Write-Output "{`"ok`":true,`"bytes`":$written}"
    exit 0
}

throw "Unknown action."

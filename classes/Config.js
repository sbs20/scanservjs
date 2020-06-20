module.exports = {
    Port: 8080,
    IsTrace: true,
    TraceLineEnding: '',
    DeviceName: null,
    Scanimage: '/usr/bin/scanimage',
    Convert: '/usr/bin/convert',
    Tesseract: '/usr/bin/tesseract',
    TesseractLanguage: 'eng',
    IgnoreStdError: '2>/dev/null',
    BypassSystemExecute: false,
    OutputDirectory: './data/output/',
    PreviewDirectory: './data/preview/',
    MaximumScanWidthInMm: 215,
    MaximumScanHeightInMm: 297,
    PreviewResolution: 100
};

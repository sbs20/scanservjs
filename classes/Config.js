module.exports = {
	Port: 8080,
	IsTrace: true,
	TraceLineEnding: '',
	Scanimage: '/usr/bin/scanimage',
	Convert: '/usr/bin/convert',
	IgnoreStdError: '2>/dev/null',
	BypassSystemExecute: false,
	OutputDirectory: './data/output/',
	PreviewDirectory: './data/preview/',
	MaximumScanWidthInMm: 215,
	MaximumScanHeightInMm: 297,
	PreviewResolution: 100,
	SupportsDepth: false;
};
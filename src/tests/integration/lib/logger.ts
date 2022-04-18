enum LoglevelOrder {
	"error",
	"warn",
	"info",
	"debug",
	"silly",
}

export function createLogger(loglevel: ioBroker.LogLevel): ioBroker.Logger {
	const loglevelNumeric =
		LoglevelOrder[loglevel ?? "debug"] ?? LoglevelOrder.debug;

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	const ignore = (): void => {};
	return {
		error: loglevelNumeric >= LoglevelOrder.error ? console.error : ignore,
		warn: loglevelNumeric >= LoglevelOrder.warn ? console.warn : ignore,
		info: loglevelNumeric >= LoglevelOrder.info ? console.log : ignore,
		debug: loglevelNumeric >= LoglevelOrder.debug ? console.log : ignore,
		silly: loglevelNumeric >= LoglevelOrder.silly ? console.log : ignore,
		level: loglevel,
	};
}

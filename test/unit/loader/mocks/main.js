const utils = require('@iobroker/adapter-core');
module.exports = () => {
	const secondary = require('./secondary');
	return {
		main: utils.controllerDir,
		secondary: secondary.controllerDir
	};
}

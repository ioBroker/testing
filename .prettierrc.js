module.exports = {
	semi: true,
	trailingComma: "all",
	singleQuote: false,
	printWidth: 80,
	useTabs: true,
	tabWidth: 4,
	endOfLine: "lf",

	overrides: [
		{
			files: ".github/workflows/*.yml",
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
	],
};

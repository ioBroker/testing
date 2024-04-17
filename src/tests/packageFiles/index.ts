/* eslint-disable @typescript-eslint/no-var-requires */
import { isArray, isObject } from "alcalzone-shared/typeguards";
import { AssertionError, expect } from "chai";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests if the adapter files are valid.
 * This is meant to be executed in a mocha context.
 */
export function validatePackageFiles(adapterDir: string): void {
	const packageJsonPath = path.join(adapterDir, "package.json");
	const ioPackageJsonPath = path.join(adapterDir, "io-package.json");

	// This allows us to skip tests that require valid JSON files
	const invalidFiles: Record<string, boolean> = {
		"package.json": false,
		"io-package.json": false,
	};
	function skipIfInvalid(
		this: Mocha.Context,
		...filenames: string[]
	): void | never {
		if (filenames.some((f) => invalidFiles[f])) return this.skip();
	}
	function markAsInvalid(this: Mocha.Context, filename: string): void {
		if (
			this.currentTest!.state === "failed" &&
			invalidFiles[filename] === false
		) {
			invalidFiles[filename] = true;
			console.error(
				`Skipping subsequent tests including "${filename}" because they require valid JSON files!`,
			);
		}
	}

	/** Ensures that a given property exists on the target object */
	function ensurePropertyExists(propertyPath: string, targetObj: any): void {
		const propertyParts = propertyPath.split(".");
		it(`The property "${propertyPath}" exists`, () => {
			let prev = targetObj;
			for (const part of propertyParts) {
				expect(prev[part]).to.not.be.undefined;
				prev = prev[part];
			}
		});
	}

	describe(`Validate the package files`, () => {
		describe(`Ensure they are readable`, () => {
			for (const filename of ["package.json", "io-package.json"]) {
				const packagePath = path.join(adapterDir, filename);

				describe(`${filename}`, () => {
					afterEach(function () {
						markAsInvalid.call(this, filename);
					});
					beforeEach(function () {
						skipIfInvalid.call(this, filename);
					});

					it("exists", () => {
						expect(
							fs.existsSync(packagePath),
							`${filename} is missing in the adapter dir. Please create it!`,
						).to.be.true;
					});

					it("contains valid JSON", () => {
						expect(() => {
							JSON.parse(fs.readFileSync(packagePath, "utf8"));
						}, `${filename} contains invalid JSON!`).not.to.throw();
					});

					it("is an object", () => {
						expect(
							require(packagePath),
							`${filename} must contain an object!`,
						).to.be.an("object");
					});
				});
			}
		});

		describe(`Check contents of package.json`, () => {
			beforeEach(function () {
				skipIfInvalid.call(this, "package.json");
			});

			const packageContent = require(packageJsonPath);
			const iopackContent = require(ioPackageJsonPath);

			const requiredProperties = [
				"name",
				"version",
				"description",
				"author",
				"license",
				"repository",
				"repository.type",
			];
			requiredProperties.forEach((prop) =>
				ensurePropertyExists(prop, packageContent),
			);

			it("The package name is correct", () => {
				let name: string = packageContent.name;
				expect(name).to.match(
					/^iobroker\./,
					`The npm package name must start with lowercase "iobroker."!`,
				);
				name = name.replace(/^iobroker\./, "");

				expect(name).to.match(
					/[a-z0-9_\-]+/,
					`The adapter name must only contain lowercase letters, numbers, "-" and "_"!`,
				);
				expect(name).to.match(
					/^[a-z]/,
					`The adapter name must start with a letter!`,
				);
				expect(name).to.match(
					/[a-z0-9]$/,
					`The adapter name must end with a letter or number!`,
				);
			});

			if (!iopackContent.common.onlyWWW) {
				it(`property main is defined for non onlyWWW adapters`, () => {
					expect(packageContent.main).to.not.be.undefined;
				});
			}

			it(`The repository type is "git"`, () => {
				expect(packageContent.repository.type).to.equal("git");
			});

			it("npm is not listed as a dependency", () => {
				for (const depType of [
					"dependencies",
					"devDependencies",
					"optionalDependencies",
					"peerDependencies",
				] as const) {
					if (
						isObject(packageContent[depType]) &&
						"npm" in packageContent[depType]
					) {
						throw new AssertionError(
							`npm must not be listed in ${depType}, found "${packageContent[depType].npm}"!`,
						);
					}
				}
			});
		});

		describe(`Check contents of io-package.json`, () => {
			beforeEach(function () {
				skipIfInvalid.call(this, "io-package.json");
			});

			const iopackContent = require(ioPackageJsonPath);

			const requiredProperties = [
				"common.name",
				"common.titleLang",
				"common.version",
				"common.news",
				"common.desc",
				"common.icon",
				"common.extIcon",
				"common.type",
				"common.authors",
				"native",
			];
			requiredProperties.forEach((prop) =>
				ensurePropertyExists(prop, iopackContent),
			);

			it(`The title does not contain "adapter" or "iobroker"`, () => {
				if (!iopackContent.title) return;
				expect(iopackContent.common.title).not.to.match(
					/iobroker|adapter/i,
				);
			});
			it(`titleLang is an object to support multiple languages`, () => {
				expect(iopackContent.common.titleLang).to.be.an("object");
			});
			it(`titleLang does not contain "adapter" or "iobroker"`, () => {
				for (const title of Object.values(
					iopackContent.common.titleLang,
				)) {
					expect(title).not.to.match(/iobroker|adapter/i);
				}
			});
			it(`The description is an object to support multiple languages`, () => {
				expect(iopackContent.common.desc).to.be.an("object");
			});
			it(`common.authors is an array that is not empty`, () => {
				const authors = iopackContent.common.authors;
				expect(isArray(authors)).to.be.true;
				expect(authors.length).to.be.at.least(1);
			});

			it(`common.news is an object that contains maximum 20 entries`, () => {
				const news = iopackContent.common.news;
				expect(isObject(news)).to.be.true;
				expect(Object.keys(news).length).to.be.at.most(20);
			});

			if (iopackContent.common.licenseInformation) {
				it(`if common.licenseInformation exists, it is an object with required properties`, () => {
					expect(iopackContent.common.licenseInformation).to.be.an(
						"object",
					);
					expect(
						iopackContent.common.licenseInformation.type,
					).to.be.oneOf(["free", "commercial", "paid", "limited"]);

					if (
						iopackContent.common.licenseInformation.type !== "free"
					) {
						expect(
							iopackContent.common.licenseInformation.link,
							"License link is missing",
						).to.not.be.undefined;
					}
				});

				it(`common.license should not exist together with common.licenseInformation`, () => {
					expect(
						iopackContent.common.license,
						"common.license must be removed",
					).to.be.undefined;
				});
			} else {
				it(`common.license must exist without common.licenseInformation`, () => {
					expect(
						iopackContent.common.license,
						"common.licenseInformation (preferred) or common.license (deprecated) must exist",
					).to.not.be.undefined;
				});
			}

			if (iopackContent.common.tier != undefined) {
				it(`common.tier must be 1, 2 or 3`, () => {
					expect(iopackContent.common.tier).to.be.at.least(1);
					expect(iopackContent.common.tier).to.be.at.most(3);
				});
			}

			// If the adapter has a configuration page, check that a supported admin UI is used
			const hasNoConfigPage =
				iopackContent.common.noConfig === true ||
				iopackContent.common.noConfig === "true" ||
				iopackContent.common.adminUI?.config === "none";
			if (!hasNoConfigPage) {
				it("The adapter uses a supported admin UI", () => {
					const hasSupportedUI =
						!!iopackContent.common.materialize ||
						iopackContent.common.adminUI?.config === "html" ||
						iopackContent.common.adminUI?.config === "json" ||
						iopackContent.common.adminUI?.config === "materialize";

					expect(
						hasSupportedUI,
						"Unsupported Admin UI, must be html, materialize or JSON config!",
					).to.be.true;
				});
			}
		});

		describe(`Compare contents of package.json and io-package.json`, () => {
			beforeEach(function () {
				skipIfInvalid.call(this, "package.json", "io-package.json");
			});

			const packageContent = require(packageJsonPath);
			const iopackContent = require(ioPackageJsonPath);

			it("The name matches", () => {
				expect("iobroker." + iopackContent.common.name).to.equal(
					packageContent.name,
				);
			});

			it("The version matches", () => {
				expect(iopackContent.common.version).to.equal(
					packageContent.version,
				);
			});

			it("The license matches", () => {
				if (iopackContent.common.licenseInformation) {
					expect(
						iopackContent.common.licenseInformation.license,
					).to.equal(packageContent.license);
				} else {
					expect(iopackContent.common.license).to.equal(
						packageContent.license,
					);
				}
			});
		});
	});

	// describe(`Check additional files`, () => {
	// 	it("README.md exists", () => {
	// 		expect(
	// 			fs.existsSync(path.join(adapterDir, "README.md")),
	// 			`README.md is missing in the adapter dir. Please create it!`,
	// 		).to.be.true;
	// 	});

	// 	it("LICENSE exists or is present in the README.md", () => {
	// 		const licenseExists = fs.existsSync(path.join(adapterDir, "LICENSE"));
	// 		if (licenseExists) return;

	// 		const readmeContent = fs.readFileSync(path.join(adapterDir, "README.md"), "utf8");
	// 		expect(readmeContent).to.match(
	// 			/## LICENSE/i,
	// 			`The license should be in a file "LICENSE" or be included in "README.md" as a 2nd level headline!`,
	// 		);
	// 	});
	// });
}

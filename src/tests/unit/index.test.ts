import { expect } from "chai";
import { createMocks } from "./harness/createMocks";

describe("Regression tests", () => {
	it("The function createMocks() can be called multiple times", () => {
		expect(() => {
			createMocks({});
		}).not.to.throw();

		expect(() => {
			createMocks({});
		}).not.to.throw();
	});
});

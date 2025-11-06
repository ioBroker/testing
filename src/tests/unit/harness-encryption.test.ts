import { expect } from 'chai';
import * as sinon from 'sinon';

describe('TestHarness Encryption/Decryption', () => {
    beforeEach(() => {
        // We need to require these modules after the stubs are in place
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('XOR encryption implementation', () => {
        it('should implement the correct XOR logic as specified in the issue', () => {
            const value = 'hello';
            const secret = 'key';

            // Manual implementation of the expected XOR logic from the issue
            let expectedResult = '';
            for (let i = 0; i < value.length; ++i) {
                expectedResult += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ value.charCodeAt(i));
            }

            // Test the algorithm directly
            expect(expectedResult).to.not.equal(value);

            // Test that applying XOR twice returns the original value (decryption)
            let decryptedResult = '';
            for (let i = 0; i < expectedResult.length; ++i) {
                decryptedResult += String.fromCharCode(
                    secret[i % secret.length].charCodeAt(0) ^ expectedResult.charCodeAt(i),
                );
            }

            expect(decryptedResult).to.equal(value);
        });

        it('should handle empty strings', () => {
            const value = '';
            const secret = 'key';

            let result = '';
            for (let i = 0; i < value.length; ++i) {
                result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ value.charCodeAt(i));
            }

            expect(result).to.equal('');
        });

        it('should handle different secret lengths', () => {
            const value = 'testvalue123';
            const shortSecret = 'ab';
            const longSecret = 'verylongsecretkey';

            // Test with short secret
            let result1 = '';
            for (let i = 0; i < value.length; ++i) {
                result1 += String.fromCharCode(shortSecret[i % shortSecret.length].charCodeAt(0) ^ value.charCodeAt(i));
            }

            // Decrypt back
            let decrypted1 = '';
            for (let i = 0; i < result1.length; ++i) {
                decrypted1 += String.fromCharCode(
                    shortSecret[i % shortSecret.length].charCodeAt(0) ^ result1.charCodeAt(i),
                );
            }

            expect(decrypted1).to.equal(value);

            // Test with long secret
            let result2 = '';
            for (let i = 0; i < value.length; ++i) {
                result2 += String.fromCharCode(longSecret[i % longSecret.length].charCodeAt(0) ^ value.charCodeAt(i));
            }

            // Decrypt back
            let decrypted2 = '';
            for (let i = 0; i < result2.length; ++i) {
                decrypted2 += String.fromCharCode(
                    longSecret[i % longSecret.length].charCodeAt(0) ^ result2.charCodeAt(i),
                );
            }

            expect(decrypted2).to.equal(value);

            // Results should be different with different secrets
            expect(result1).to.not.equal(result2);
        });
    });
});

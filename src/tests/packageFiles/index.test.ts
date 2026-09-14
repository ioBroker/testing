import { Ajv, type ErrorObject } from 'ajv';
import { expect } from 'chai';
import { formatSchemaErrors } from './index';

describe('formatSchemaErrors()', () => {
    const validate = new Ajv({ allErrors: true, strict: false }).compile({
        type: 'object',
        required: ['common'],
        additionalProperties: false,
        properties: {
            common: {
                type: 'object',
                properties: { name: { type: 'string' } },
            },
            native: { type: 'object' },
        },
    });

    it('returns an empty string without errors', () => {
        expect(formatSchemaErrors(null)).to.equal('');
        expect(formatSchemaErrors(undefined)).to.equal('');
        expect(formatSchemaErrors([])).to.equal('');
    });

    it('writes one line per error with the path of the invalid value', () => {
        expect(validate({ native: 1 })).to.be.false;
        const text = formatSchemaErrors(validate.errors);
        expect(text).to.include(`  - /: must have required property 'common'`);
        expect(text).to.include(`  - /native: must be object`);
        expect(text.split('\n')).to.have.lengthOf(validate.errors!.length);
    });

    it('names the property that is not allowed', () => {
        expect(validate({ common: {}, commn: {} })).to.be.false;
        expect(formatSchemaErrors(validate.errors)).to.equal(`  - /: must NOT have additional properties "commn"`);
    });

    it('reports the same problem only once', () => {
        const error: ErrorObject = {
            keyword: 'type',
            instancePath: '/common/name',
            schemaPath: '#/properties/common/properties/name/type',
            params: { type: 'string' },
            message: 'must be string',
        };
        expect(formatSchemaErrors([error, { ...error }])).to.equal('  - /common/name: must be string');
    });
});

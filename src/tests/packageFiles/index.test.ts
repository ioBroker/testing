import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { expect } from 'chai';
import { adaptSchemaForNewsPlaceholder, formatSchemaErrors } from './index';

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

describe('adaptSchemaForNewsPlaceholder()', () => {
    /** The `common.news` part of the io-package.json schema, as js-controller publishes it */
    function newsSchema(): Record<string, any> {
        return {
            type: 'object',
            properties: {
                common: {
                    type: 'object',
                    properties: {
                        news: {
                            type: 'object',
                            minProperties: 1,
                            maxProperties: 20,
                            patternProperties: {
                                '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$': {
                                    $ref: '#/definitions/multilingual',
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                },
            },
            definitions: {
                multilingual: {
                    type: 'object',
                    required: ['en'],
                    patternProperties: { 'en|de|ru|pt|nl|fr|it|es|pl|uk|zh-cn': { type: 'string' } },
                    additionalProperties: false,
                },
            },
        };
    }

    function compile(schema: Record<string, any>): ValidateFunction {
        return new Ajv({ allErrors: true, strict: false }).compile(schema);
    }

    function ioPackage(news: Record<string, any>): Record<string, any> {
        return { common: { news } };
    }

    it('is needed: the published schema rejects the placeholder', () => {
        const validate = compile(newsSchema());
        expect(validate(ioPackage({ NEXT: { en: 'x' } }))).to.be.false;
        expect(formatSchemaErrors(validate.errors)).to.equal(
            '  - /common/news: must NOT have additional properties "NEXT"',
        );
    });

    it('accepts the placeholder next to version entries and on its own', () => {
        const schema = newsSchema();
        adaptSchemaForNewsPlaceholder(schema);
        const validate = compile(schema);
        expect(validate(ioPackage({ NEXT: { en: 'x' }, '1.0.0': { en: 'y', de: 'z' } }))).to.be.true;
        expect(validate(ioPackage({ NEXT: { en: 'x' } }))).to.be.true;
        expect(validate(ioPackage({ '1.0.0': { en: 'y' } }))).to.be.true;
    });

    it('validates the content of the placeholder like a version entry', () => {
        const schema = newsSchema();
        adaptSchemaForNewsPlaceholder(schema);
        const validate = compile(schema);

        expect(validate(ioPackage({ NEXT: { de: 'x' } }))).to.be.false;
        expect(formatSchemaErrors(validate.errors)).to.equal("  - /common/news/NEXT: must have required property 'en'");

        expect(validate(ioPackage({ NEXT: 'x' }))).to.be.false;
        expect(formatSchemaErrors(validate.errors)).to.equal('  - /common/news/NEXT: must be object');

        expect(validate(ioPackage({ NEXT: { en: 'x', xx: 'y' } }))).to.be.false;
        expect(formatSchemaErrors(validate.errors)).to.equal(
            '  - /common/news/NEXT: must NOT have additional properties "xx"',
        );
    });

    it('allows nothing but the placeholder in addition to versions', () => {
        const schema = newsSchema();
        adaptSchemaForNewsPlaceholder(schema);
        const validate = compile(schema);
        expect(validate(ioPackage({ next: { en: 'x' } }))).to.be.false;
        expect(validate(ioPackage({ 'NEXT ': { en: 'x' } }))).to.be.false;
        expect(validate(ioPackage({ '1.0.0': { en: 'x' }, foo: { en: 'x' } }))).to.be.false;
        expect(validate(ioPackage({}))).to.be.false;
    });

    it('leaves a schema without a pattern for the news untouched', () => {
        const schema = { type: 'object', properties: { common: { type: 'object' } } };
        const before = JSON.stringify(schema);
        adaptSchemaForNewsPlaceholder(schema);
        expect(JSON.stringify(schema)).to.equal(before);
        adaptSchemaForNewsPlaceholder({});
    });
});

import { Schema, SchemaEntry } from '../src';
import { createClient } from './lib/MockClient';

describe('SchemaEntry', () => {
	test('SchemaEntry Properties', () => {
		const schema = new Schema();
		const schemaEntry = new SchemaEntry(schema, 'test', 'textchannel');

		expect(schemaEntry.client).toBe(null);
		expect(schemaEntry.key).toBe('test');
		expect(schemaEntry.path).toBe('test');
		expect(schemaEntry.type).toBe('textchannel');
		expect(schemaEntry.parent).toBe(schema);
		expect(schemaEntry.array).toBe(false);
		expect(schemaEntry.configurable).toBe(true);
		expect(schemaEntry.default).toBe(null);
		expect(schemaEntry.filter).toBe(null);
		expect(schemaEntry.inclusive).toBe(false);
		expect(schemaEntry.maximum).toBe(null);
		expect(schemaEntry.minimum).toBe(null);
		expect(schemaEntry.shouldResolve).toBe(true);
		expect(() => schemaEntry.serializer).toThrowError();
		expect(schemaEntry.toJSON()).toEqual({
			array: false,
			configurable: true,
			default: null,
			inclusive: false,
			maximum: null,
			minimum: null,
			resolve: true,
			type: 'textchannel'
		});
	});

	test('SchemaEntry#edit', () => {
		const schema = new Schema();
		const schemaEntry = new SchemaEntry(schema, 'test', 'textchannel', {
			array: false,
			configurable: false,
			default: 1,
			filter: (): boolean => true,
			inclusive: false,
			maximum: 100,
			minimum: 98,
			resolve: false
		});

		schemaEntry.edit({
			type: 'guild',
			array: true,
			configurable: true,
			default: [1],
			filter: null,
			inclusive: true,
			maximum: 200,
			minimum: 100,
			resolve: true
		});

		expect(schemaEntry.type).toBe('guild');
		expect(schemaEntry.array).toBe(true);
		expect(schemaEntry.configurable).toBe(true);
		expect(schemaEntry.filter).toBe(null);
		expect(schemaEntry.shouldResolve).toBe(true);
		expect(schemaEntry.maximum).toBe(200);
		expect(schemaEntry.minimum).toBe(100);
		expect(schemaEntry.default).toEqual([1]);
	});

	test('SchemaEntry#check', () => {
		const client = createClient();
		const schema = new Schema();
		const schemaEntry = new SchemaEntry(schema, 'test', 'textchannel');
		const throwsCheck = (): void => schemaEntry._check();

		// #region Client
		// No client
		expect(throwsCheck).toThrowError(/Cannot retrieve serializers/i);
		schemaEntry.client = client;
		// #endregion

		// #region Type
		// @ts-expect-error bypassing invalid code for test
		schemaEntry.type = null;
		expect(throwsCheck).toThrowError(/Parameter 'type' must be a string/i);

		schemaEntry.type = 'totallyaserializerpleasebelieveme';
		expect(throwsCheck).toThrowError(/is not a valid type/i);

		// Reset to a valid type
		schemaEntry.type = 'string';
		// #endregion

		// #region Booleans
		// @ts-expect-error bypassing invalid code for test
		schemaEntry.array = 'true';
		expect(throwsCheck).toThrowError(/Parameter 'array' must be a boolean/i);
		schemaEntry.array = false;

		// @ts-expect-error bypassing invalid code for test
		schemaEntry.configurable = 'true';
		expect(throwsCheck).toThrowError(/Parameter 'configurable' must be a boolean/i);
		schemaEntry.configurable = true;

		// @ts-expect-error bypassing invalid code for test
		schemaEntry.minimum = '123';
		expect(throwsCheck).toThrowError(/Parameter 'minimum' must be a number or null/i);
		schemaEntry.minimum = 123;

		// @ts-expect-error bypassing invalid code for test
		schemaEntry.maximum = '100';
		expect(throwsCheck).toThrowError(/Parameter 'maximum' must be a number or null/i);
		schemaEntry.maximum = 100;

		expect(throwsCheck).toThrowError(/Parameter 'minimum' must contain a value lower than the parameter 'maximum'/i);
		schemaEntry.maximum = 200;
		// #endregion

		// @ts-expect-error bypassing invalid code for test
		schemaEntry.filter = 'true';
		expect(throwsCheck).toThrowError(/Parameter 'filter' must be a function/i);
		schemaEntry.filter = null;

		// Checking if the default is an array and the type is an array
		schemaEntry.array = true;
		schemaEntry.default = null;
		expect(throwsCheck).toThrowError(/Default key must be an array if the key stores an array/i);

		// Checking if the type is a string, but the default isn't
		schemaEntry.array = false;
		schemaEntry.type = 'string';
		schemaEntry.default = true;
		expect(throwsCheck).toThrowError(/Default key must be a/i);
		client.destroy();
	});

	test('SchemaEntry#toJSON', () => {
		const schema = new Schema();
		const schemaEntry = new SchemaEntry(schema, 'test', 'textchannel', {
			array: true,
			configurable: false,
			default: [],
			inclusive: true,
			maximum: 1000,
			minimum: 100,
			resolve: true
		});

		const json = schemaEntry.toJSON();

		expect(json).toEqual({
			type: 'textchannel',
			array: true,
			configurable: false,
			default: [],
			inclusive: true,
			maximum: 1000,
			minimum: 100,
			resolve: true
		});
	});

	test('SchemaEntry#default (Automatic)', () => {
		const schema = new Schema();
		const schemaEntry = new SchemaEntry(schema, 'test', 'textchannel');

		// @ts-ignore 2341
		const generateDefault = (): unknown => schemaEntry._generateDefaultValue();

		expect(generateDefault()).toBe(null);

		schemaEntry.edit({ array: true });
		expect(generateDefault()).toEqual([]);

		schemaEntry.edit({ array: false, type: 'boolean' });
		expect(generateDefault()).toBe(false);
	});
});

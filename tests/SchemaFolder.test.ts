import { Schema, SchemaEntry, SchemaFolder, SettingsFolder } from '../src';

describe('SchemaFolder', () => {
	test('SchemaFolder Properties', () => {
		expect.assertions(5);

		const schema = new Schema();
		const schemaFolder = new SchemaFolder(schema, 'someFolder');

		expect(schemaFolder.parent).toBe(schema);
		expect(schemaFolder.key).toBe('someFolder');
		expect(schemaFolder.defaults instanceof SettingsFolder).toBe(true);
		expect(schemaFolder.defaults.size).toBe(0);
		expect(schemaFolder.toJSON()).toEqual({});
	});

	test('SchemaFolder (Child)', () => {
		expect.assertions(4);

		const schema = new Schema();
		const schemaFolder = new SchemaFolder(schema, 'someFolder').add('someKey', 'textchannel');

		expect(schemaFolder.defaults.size).toBe(1);
		expect(schemaFolder.defaults.get('someKey')).toBe(null);
		expect((schemaFolder.get('someKey') as SchemaEntry).parent).toBe(schemaFolder);
		expect(schemaFolder.toJSON()).toEqual({
			someKey: {
				array: false,
				configurable: true,
				default: null,
				inclusive: false,
				maximum: null,
				minimum: null,
				resolve: true,
				type: 'textchannel'
			}
		});
	});
});

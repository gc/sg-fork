import { Schema, SchemaEntry, SchemaFolder, SettingsFolder } from '../src';

describe('Schema', () => {
	test('Schema Properties', () => {
		expect.assertions(13);

		const schema = new Schema();

		expect(schema.path).toBe('');
		expect(schema.type).toBe('Folder');

		expect(schema instanceof Map).toBe(true);
		expect(schema.size).toBe(0);

		expect(schema.defaults instanceof SettingsFolder).toBe(true);
		expect(schema.defaults.size).toBe(0);

		expect(schema.toJSON()).toEqual({});

		expect([...schema.keys()]).toEqual([]);
		expect([...schema.keys(true)]).toEqual([]);
		expect([...schema.values()]).toEqual([]);
		expect([...schema.values(true)]).toEqual([]);
		expect([...schema.entries()]).toEqual([]);
		expect([...schema.entries(true)]).toEqual([]);
	});

	test('Schema#add', () => {
		expect.assertions(20);

		const schema = new Schema();
		expect(schema.add('test', 'String')).toBe(schema);

		expect(schema instanceof Schema).toBe(true);
		expect(schema.path).toBe('');
		expect(schema.type).toBe('Folder');

		expect(schema.defaults.size).toBe(1);
		const settingsEntry = schema.defaults.get('test');
		expect(settingsEntry).toBe(null);

		expect(schema.size).toBe(1);
		const schemaEntry = schema.get('test') as SchemaEntry;
		expect(schemaEntry instanceof SchemaEntry).toBe(true);
		expect(schemaEntry.key).toBe('test');
		expect(schemaEntry.parent).toBe(schema);
		expect(schemaEntry.path).toBe('test');
		expect(schemaEntry.type).toBe('string');
		expect(schemaEntry.toJSON()).toEqual({
			array: false,
			configurable: true,
			default: null,
			inclusive: false,
			maximum: null,
			minimum: null,
			resolve: true,
			type: 'string'
		});

		expect(schema.toJSON()).toEqual({
			test: {
				array: false,
				configurable: true,
				default: null,
				inclusive: false,
				maximum: null,
				minimum: null,
				resolve: true,
				type: 'string'
			}
		});

		expect([...schema.keys()]).toEqual(['test']);
		expect([...schema.keys(true)]).toEqual(['test']);
		expect([...schema.values()]).toEqual([schemaEntry]);
		expect([...schema.values(true)]).toEqual([schemaEntry]);
		expect([...schema.entries()]).toEqual([['test', schemaEntry]]);
		expect([...schema.entries(true)]).toEqual([['test', schemaEntry]]);
	});

	test('Schema#add (Edit | Entry To Entry)', () => {
		expect.assertions(5);

		const schema = new Schema().add('subkey', 'String');
		expect(schema.defaults.get('subkey')).toBe(null);
		expect((schema.get('subkey') as SchemaEntry).default).toBe(null);

		expect(schema.add('subkey', 'String', { default: 'Hello' })).toBe(schema);
		expect(schema.defaults.get('subkey')).toBe('Hello');
		expect((schema.get('subkey') as SchemaEntry).default).toBe('Hello');
	});

	test('Schema#add (Edit | Entry To Folder)', () => {
		const schema = new Schema().add('subkey', (folder) => folder.add('nested', 'String'));
		expect(() => schema.add('subkey', 'String')).toThrowError(
			'The type for "subkey" conflicts with the previous value, expected a non-Folder, got "Folder".'
		);
	});

	test('Schema#add (Edit | Folder To Entry)', () => {
		const schema = new Schema().add('subkey', 'String');
		expect(() => schema.add('subkey', (folder) => folder)).toThrowError(
			'The type for "subkey" conflicts with the previous value, expected type "Folder", got "string".'
		);
	});

	test('Schema#add (Edit | Folder To Folder)', () => {
		expect.assertions(5);

		const schema = new Schema().add('subkey', (folder) => folder.add('nested', 'String'));
		expect(schema.add('subkey', (folder) => folder.add('another', 'Number'))).toBe(schema);
		expect(schema.size).toBe(1);

		const inner = schema.get('subkey') as SchemaFolder;
		expect(inner.size).toBe(2);
		expect(inner.get('nested')).toBeTruthy();
		expect(inner.get('another')).toBeTruthy();
	});

	test('Schema#add (Ready)', () => {
		const schema = new Schema();
		schema.ready = true;

		expect(() => schema.add('subkey', 'String')).toThrowError('Cannot modify the schema after being initialized.');
	});

	test('Schema#get (Entry)', () => {
		const schema = new Schema().add('subkey', 'String');
		expect(schema.get('subkey') instanceof SchemaEntry).toBe(true);
	});

	test('Schema#get (Folder)', () => {
		const schema = new Schema().add('subkey', (folder) => folder);
		expect(schema.get('subkey') instanceof SchemaFolder).toBe(true);
	});

	test('Schema#get (Folder Nested)', () => {
		const schema = new Schema().add('subkey', (folder) => folder.add('nested', 'String'));
		expect(schema.get('subkey.nested') instanceof SchemaEntry).toBe(true);
	});

	test('Schema#get (Folder Double Nested)', () => {
		const schema = new Schema().add('subkey', (folder) => folder.add('nested', (subFolder) => subFolder.add('double', 'String')));
		expect(schema.get('subkey.nested.double') instanceof SchemaEntry).toBe(true);
	});

	test('Schema#get (Folder From Entry)', () => {
		const schema = new Schema().add('key', 'String');
		expect(schema.get('key.non.existent.path')).toBe(undefined);
	});

	test('SchemaFolder (Empty)', () => {
		expect.assertions(22);

		const schema = new Schema().add('test', () => {
			// noop
		});

		expect(schema instanceof Schema).toBe(true);
		expect(schema.path).toBe('');
		expect(schema.type).toBe('Folder');

		expect(schema.defaults.size).toBe(1);
		const settingsFolder = schema.defaults.get('test') as SettingsFolder;
		expect(settingsFolder instanceof SettingsFolder).toBe(true);
		expect(settingsFolder.size).toBe(0);

		expect(schema.size).toBe(1);
		const schemaFolder = schema.get('test') as SchemaFolder;
		expect(schemaFolder instanceof SchemaFolder).toBe(true);
		expect(schemaFolder.size).toBe(0);
		expect(schemaFolder.key).toBe('test');
		expect(schemaFolder.parent).toBe(schema);
		expect(schemaFolder.path).toBe('test');
		expect(schemaFolder.type).toBe('Folder');
		expect(schemaFolder.defaults instanceof SettingsFolder).toBe(true);
		expect(schemaFolder.defaults.size).toBe(0);

		expect(schema.toJSON()).toEqual({
			test: {}
		});

		expect([...schema.keys()]).toEqual(['test']);
		expect([...schema.keys(true)]).toEqual([]);
		expect([...schema.values()]).toEqual([schemaFolder]);
		expect([...schema.values(true)]).toEqual([]);
		expect([...schema.entries()]).toEqual([['test', schemaFolder]]);
		expect([...schema.entries(true)]).toEqual([]);
	});

	test('SchemaFolder (Filled)', () => {
		expect.assertions(29);

		const schema = new Schema().add('someFolder', (folder) => folder.add('someKey', 'TextChannel'));

		expect(schema.defaults.size).toBe(1);
		const settingsFolder = schema.defaults.get('someFolder') as SettingsFolder;
		expect(settingsFolder instanceof SettingsFolder).toBe(true);
		expect(settingsFolder.size).toBe(1);
		expect(settingsFolder.get('someKey')).toBe(null);
		expect(schema.defaults.get('someFolder.someKey')).toBe(null);

		expect(schema.size).toBe(1);
		const schemaFolder = schema.get('someFolder') as SchemaFolder;
		expect(schemaFolder instanceof SchemaFolder).toBe(true);
		expect(schemaFolder.size).toBe(1);
		expect(schemaFolder.key).toBe('someFolder');
		expect(schemaFolder.parent).toBe(schema);
		expect(schemaFolder.path).toBe('someFolder');
		expect(schemaFolder.type).toBe('Folder');
		expect(schemaFolder.defaults instanceof SettingsFolder).toBe(true);
		expect(schemaFolder.defaults.size).toBe(1);

		const innerSettingsFolder = schemaFolder.defaults.get('someKey');
		expect(innerSettingsFolder).toBe(null);

		const schemaEntry = schemaFolder.get('someKey') as SchemaEntry;
		expect(schemaEntry instanceof SchemaEntry).toBe(true);
		expect(schemaEntry.key).toBe('someKey');
		expect(schemaEntry.parent).toBe(schemaFolder);
		expect(schemaEntry.path).toBe('someFolder.someKey');
		expect(schemaEntry.type).toBe('textchannel');
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

		expect(schema.get('someFolder.someKey')).toBe(schemaFolder.get('someKey'));

		expect(schema.toJSON()).toEqual({
			someFolder: {
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
			}
		});

		expect([...schema.keys()]).toEqual(['someFolder']);
		expect([...schema.keys(true)]).toEqual(['someKey']);
		expect([...schema.values()]).toEqual([schemaFolder]);
		expect([...schema.values(true)]).toEqual([schemaEntry]);
		expect([...schema.entries()]).toEqual([['someFolder', schemaFolder]]);
		expect([...schema.entries(true)]).toEqual([['someKey', schemaEntry]]);
	});

	test('Schema#delete', () => {
		expect.assertions(3);

		const schema = new Schema().add('subkey', 'String');
		expect(schema.defaults.get('subkey')).toBe(null);

		expect(schema.delete('subkey')).toBe(true);
		expect(schema.defaults.get('subkey')).toBe(undefined);
	});

	test('Schema#delete (Not Exists)', () => {
		const schema = new Schema();
		expect(schema.delete('subkey')).toBe(false);
	});

	test('Schema#delete (Ready)', () => {
		const schema = new Schema();
		schema.ready = true;

		expect(() => schema.delete('subkey')).toThrowError('Cannot modify the schema after being initialized.');
	});
});

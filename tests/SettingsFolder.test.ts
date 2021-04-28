import {
	Client as InternalClient,
	Gateway,
	KeyedObject,
	Provider,
	Schema,
	SchemaEntry,
	Settings,
	SettingsExistenceStatus,
	SettingsFolder,
	SettingsUpdateContext
} from '../src';
import { createClient } from './lib/MockClient';
import { unreachable } from './lib/Util';

describe('SettingsFolder', () => {
	let client: InternalClient;
	let gateway: Gateway;
	let schema: Schema;
	let provider: Provider;
	let settings: Settings;

	beforeEach(async () => {
		client = createClient();

		schema = new Schema()
			.add('uses', 'number', { array: true })
			.add('count', 'number', { configurable: false })
			.add('messages', (messages) => messages.add('ignoring', (ignoring) => ignoring.add('amount', 'number')).add('hello', 'object'));

		gateway = new Gateway(client, 'settings-test', { provider: 'Mock', schema });
		client.gateways.register(gateway);

		await gateway.init();

		provider = gateway.provider as Provider;
		settings = new Settings(gateway, { id: 'MockTest' }, 'MockTest');
	});

	afterEach(() => {
		client.destroy();
	});

	test('SettingsFolder (Basic)', () => {
		const settingsFolder = new SettingsFolder(schema);

		expect(settingsFolder.base).toBe(null);
		expect(settingsFolder.schema).toBe(schema);
		expect(settingsFolder.size).toBe(0);
		expect(() => settingsFolder.client).toThrowError('Cannot retrieve gateway from a non-ready settings instance');
	});

	test('SettingsFolder#{base,client}', () => {
		const settingsFolder = settings.get('messages') as SettingsFolder;

		expect(() => settingsFolder.client).not.toThrow();
		expect(settingsFolder.base).toBe(settings);
	});

	test('SettingsFolder#get', () => {
		// Retrieve key from root folder
		expect(settings.size).toBe(3);
		expect(settings.get('uses')).toBe((schema.get('uses') as SchemaEntry).default);
		expect(settings.get('count')).toBe(null);
		expect(settings.get('messages.hello')).toBe(null);

		// Retrieve nested folder from root folder
		const settingsFolder = settings.get('messages') as SettingsFolder;
		expect(settingsFolder instanceof SettingsFolder).toBe(true);
		expect(settingsFolder.size).toBe(2);
		expect(settingsFolder.get('hello')).toBe(null);

		// Invalid paths should return undefined
		expect(settings.get('fake.path')).toBe(undefined);

		// Invalid parameter to get should return undefined
		// @ts-expect-error bypassing invalid code for test
		expect(settings.get(null)).toBe(undefined);
	});

	test('SettingsFolder#pluck', async () => {
		await provider.create(gateway.name, settings.id, { count: 65 });
		await settings.sync();

		expect(settings.pluck('count')).toEqual([65]);
		expect(settings.pluck('messages.hello')).toEqual([null]);
		expect(settings.pluck('invalid.path')).toEqual([undefined]);
		expect(settings.pluck('count', 'messages.hello', 'invalid.path')).toEqual([65, null, undefined]);
		expect(settings.pluck('count', 'messages')).toEqual([65, { hello: null, ignoring: { amount: null } }]);
	});

	test('SettingsFolder#resolve', async () => {
		await provider.create(gateway.name, settings.id, { count: 65 });
		await settings.sync();

		// Check if single value from root's folder is resolved correctly
		expect(await settings.resolve('count')).toEqual([65]);

		// Check if multiple values are resolved correctly
		expect(await settings.resolve('count', 'messages')).toEqual([65, { hello: null, ignoring: { amount: null } }]);

		// Update and give it an actual value
		await provider.update(gateway.name, settings.id, { messages: { hello: 'Hello' } });
		await settings.sync(true);
		expect(await settings.resolve('messages.hello')).toEqual([{ data: 'Hello' }]);

		// Invalid path
		expect(await settings.resolve('invalid.path')).toEqual([undefined]);
	});

	test('SettingsFolder#resolve (Folder)', async () => {
		expect(await settings.resolve('messages')).toEqual([{ hello: null, ignoring: { amount: null } }]);
	});

	test('SettingsFolder#resolve (Not Ready)', async () => {
		const settingsFolder = new SettingsFolder(schema);
		expect(settingsFolder.base).toBe(null);

		const resolveResult = settingsFolder.resolve('uses');
		await expect(resolveResult).rejects.toThrowError('Cannot retrieve guild from a non-ready settings instance.');
	});

	test('SettingsFolder#reset (Single | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset('count')).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Single | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, count: 64 });
		const results = await settings.reset('count');
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(64);
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('count') as SchemaEntry);
		expect(settings.get('count')).toBe(null);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, count: null });
	});

	test('SettingsFolder#reset (Multiple[Array] | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset(['count', 'messages.hello'])).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Multiple[Array] | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const results = await settings.reset(['count', 'messages.hello']);
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Multiple[Object] | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset({ count: true, 'messages.hello': true })).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Multiple[Object] | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const results = await settings.reset({ count: true, 'messages.hello': true });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Multiple[Object-Deep] | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset({ count: true, messages: { hello: true } })).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Multiple[Object-Deep] | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const results = await settings.reset({ count: true, messages: { hello: true } });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Root | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset()).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Root | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const results = await settings.reset();
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Folder | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		expect(await settings.reset('messages')).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Folder | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const results = await settings.reset('messages');
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Inner-Folder | Not Exists)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		const settingsFolder = settings.get('messages') as SettingsFolder;
		expect(await settingsFolder.reset()).toEqual([]);
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#reset (Inner-Folder | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
		const settingsFolder = settings.get('messages') as SettingsFolder;
		const results = await settingsFolder.reset();
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe('world');
		expect(results[0].next).toBe(null);
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#reset (Array | Empty)', async () => {
		await provider.create(gateway.name, settings.id, {});
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id });
		const results = await settings.reset('uses');
		expect(results.length).toBe(0);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id });
	});

	test('SettingsFolder#reset (Array | Filled)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
		const results = await settings.reset('uses');
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toBe((schema.get('uses') as SchemaEntry).default);
		expect(results[0].entry).toBe(schema.get('uses') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [] });
	});

	test('SettingsFolder#reset (Events | Not Exists)', async () => {
		await settings.sync();

		client.once('settingsCreate', () => {
			throw new Error();
		});
		client.once('settingsUpdate', () => {
			throw new Error();
		});
		expect(await settings.reset('count')).toEqual([]);
	});

	test('SettingsFolder#reset (Events | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: null });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(schemaEntry.default);
			expect(context.extraContext).toBe(undefined);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.reset('count');
	});

	test('SettingsFolder#reset (Events + Extra | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const extraContext = Symbol('Hello!');
		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: null });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(schemaEntry.default);
			expect(context.extraContext).toBe(extraContext);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.reset('count', { extraContext });
	});

	test('SettingsFolder#reset (Uninitialized)', async () => {
		const settings = new SettingsFolder(new Schema());
		const resetResult = settings.reset();
		await expect(resetResult).rejects.toThrowError('Cannot reset keys from a non-ready settings instance.');
	});

	test('SettingsFolder#reset (Unsynchronized)', async () => {
		const resetResult = settings.reset();
		await expect(resetResult).rejects.toThrowError(
			'Cannot reset keys from a pending to synchronize settings instance. Perhaps you want to call `sync()` first.'
		);
	});

	test('SettingsFolder#reset (Invalid Key)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		const resetResult = settings.reset('invalid.path');
		await expect(resetResult).rejects.toThrowError('[SETTING_GATEWAY_KEY_NOEXT]: invalid.path');
	});

	test('SettingsFolder#reset (Unconfigurable)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const resetResult = settings.reset('count', { onlyConfigurable: true });
		await expect(resetResult).rejects.toThrowError('[SETTING_GATEWAY_UNCONFIGURABLE_KEY]: count');
	});

	test('SettingsFolder#update (Single)', async () => {
		await settings.sync();

		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.NotExists);
		const results = await settings.update('count', 2);
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(null);
		expect(results[0].next).toBe(2);
		expect(results[0].entry).toBe(schema.get('count') as SchemaEntry);
		expect(settings.get('count')).toBe(2);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, count: 2 });
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.Exists);
	});

	test('SettingsFolder#update (Multiple)', async () => {
		await settings.sync();

		const results = await settings.update([
			['count', 6],
			['uses', [4]]
		]);
		expect(results.length).toBe(2);

		// count
		expect(results[0].previous).toBe(null);
		expect(results[0].next).toBe(6);
		expect(results[0].entry).toBe(schema.get('count') as SchemaEntry);

		// uses
		expect(results[1].previous).toEqual([]);
		expect(results[1].next).toEqual([4]);
		expect(results[1].entry).toBe(schema.get('uses') as SchemaEntry);

		// persistence
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, count: 6, uses: [4] });
	});

	test('SettingsFolder#update (Multiple | Object)', async () => {
		await settings.sync();

		const results = await settings.update({ count: 6, uses: [4] });
		expect(results.length).toBe(2);

		// count
		expect(results[0].previous).toBe(null);
		expect(results[0].next).toBe(6);
		expect(results[0].entry).toBe(schema.get('count') as SchemaEntry);

		// uses
		expect(results[1].previous).toEqual([]);
		expect(results[1].next).toEqual([4]);
		expect(results[1].entry).toBe(schema.get('uses') as SchemaEntry);

		// persistence
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, count: 6, uses: [4] });
	});

	test('SettingsFolder#update (Folder)', async () => {
		await settings.sync();

		const updateResult = settings.update('messages', 420);
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_CHOOSE_KEY]: ignoring hello');
	});

	test('SettingsFolder#update (Not Exists | Default Value)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		await settings.update('uses', null);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [] });
	});

	test('SettingsFolder#update (Inner-Folder | Not Exists | Default Value)', async () => {
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toBe(null);
		const settingsFolder = settings.get('messages') as SettingsFolder;
		await settingsFolder.update('hello', null);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: null } });
	});

	test('SettingsFolder#update (Inner-Folder | Exists)', async () => {
		await settings.sync();

		const settingsFolder = settings.get('messages') as SettingsFolder;
		const results = await settingsFolder.update('hello', 'world');
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(null);
		expect(results[0].next).toBe('world');
		expect(results[0].entry).toBe(gateway.schema.get('messages.hello') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, messages: { hello: 'world' } });
	});

	test('SettingsFolder#update (ArrayAction | Empty | Default)', async () => {
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2]);
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2] });
	});

	test('SettingsFolder#update (ArrayAction | Filled | Default)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
		const results = await settings.update('uses', [1, 2, 4]);
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([]);
		expect(results[0].entry).toBe(schema.get('uses') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [] });
	});

	test('SettingsFolder#update (ArrayAction | Empty | Auto)', async () => {
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2], { arrayAction: 'auto' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2] });
	});

	test('SettingsFolder#update (ArrayAction | Filled | Auto)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
		const results = await settings.update('uses', [1, 2, 4], { arrayAction: 'auto' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([]);
		expect(results[0].entry).toBe(schema.get('uses') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [] });
	});

	test('SettingsFolder#update (ArrayAction | Empty | Add)', async () => {
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2], { arrayAction: 'add' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2] });
	});

	test('SettingsFolder#update (ArrayAction | Filled | Add)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
		const results = await settings.update('uses', [3, 5, 6], { arrayAction: 'add' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([1, 2, 4, 3, 5, 6]);
		expect(results[0].entry).toBe(schema.get('uses') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4, 3, 5, 6] });
	});

	test('SettingsFolder#update (ArrayAction | Empty | Remove)', async () => {
		await settings.sync();
		const updateResult = settings.update('uses', [1, 2], { arrayAction: 'remove' });
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_MISSING_VALUE]: uses 1');
		expect(await provider.get(gateway.name, settings.id)).toBe(null);
	});

	test('SettingsFolder#update (ArrayAction | Filled | Remove)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2], { arrayAction: 'remove' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([4]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [4] });
	});

	test('SettingsFolder#update (ArrayAction | Filled | Remove With Nulls)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 3, 4] });
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [null, null], { arrayAction: 'remove', arrayIndex: 1 });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 3, 4]);
		expect(results[0].next).toEqual([1, 4]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 4] });
	});

	test('SettingsFolder#update (ArrayAction | Empty | Overwrite)', async () => {
		await settings.sync();

		const schemaEntry = gateway.schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2, 4], { arrayAction: 'overwrite' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2, 4]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
	});

	test('SettingsFolder#update (ArrayAction | Filled | Overwrite)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
		const results = await settings.update('uses', [3, 5, 6], { arrayAction: 'overwrite' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([3, 5, 6]);
		expect(results[0].entry).toBe(schema.get('uses') as SchemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [3, 5, 6] });
	});

	test('SettingsFolder#update (ArrayIndex | Empty | Auto)', async () => {
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2, 3], { arrayIndex: 0 });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2, 3]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 3] });
	});

	test('SettingsFolder#update (ArrayIndex | Filled | Auto)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [5, 6], { arrayIndex: 0 });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([5, 6, 4]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [5, 6, 4] });
	});

	test('SettingsFolder#update (ArrayIndex | Empty | Add)', async () => {
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2, 3], { arrayIndex: 0, arrayAction: 'add' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([1, 2, 3]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 3] });
	});

	test('SettingsFolder#update (ArrayIndex | Filled | Add)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [5, 6], { arrayIndex: 0, arrayAction: 'add' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([5, 6, 1, 2, 4]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [5, 6, 1, 2, 4] });
	});

	test('SettingsFolder#update (ArrayIndex | Filled | Add | Error)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const updateResult = settings.update('uses', 4, { arrayAction: 'add' });
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_DUPLICATE_VALUE]: uses 4');
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
	});

	test('SettingsFolder#update (ArrayIndex | Empty | Remove)', async () => {
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2], { arrayIndex: 0, arrayAction: 'remove' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toBe(schemaEntry.default);
		expect(results[0].next).toEqual([]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [] });
	});

	test('SettingsFolder#update (ArrayIndex | Filled | Remove)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const schemaEntry = schema.get('uses') as SchemaEntry;
		const results = await settings.update('uses', [1, 2], { arrayIndex: 1, arrayAction: 'remove' });
		expect(results.length).toBe(1);
		expect(results[0].previous).toEqual([1, 2, 4]);
		expect(results[0].next).toEqual([1]);
		expect(results[0].entry).toBe(schemaEntry);
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1] });
	});

	test('SettingsFolder#update (ArrayIndex | Filled | Remove | Error)', async () => {
		await provider.create(gateway.name, settings.id, { uses: [1, 2, 4] });
		await settings.sync();

		const updateResult = settings.update('uses', 3, { arrayAction: 'remove' });
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_MISSING_VALUE]: uses 3');
		expect(await provider.get(gateway.name, settings.id)).toEqual({ id: settings.id, uses: [1, 2, 4] });
	});

	test('SettingsFolder#update (Events | Not Exists)', async () => {
		await settings.sync();

		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 64 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(schemaEntry.default);
			expect(context.changes[0].next).toBe(64);
			expect(context.extraContext).toBe(undefined);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		client.once('settingsUpdate', unreachable);
		await settings.update('count', 64);
	});

	test('SettingsFolder#update (Events | Exists | Simple)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 420 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(420);
			expect(context.extraContext).toBe(undefined);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.update('count', 420);
	});

	test('SettingsFolder#update (Events | Exists | Array Overload | Options)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 420 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(420);
			expect(context.extraContext).toBe('Hello!');
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.update([['count', 420]], { extraContext: 'Hello!' });
	});

	test('SettingsFolder#update (Events | Exists | Object Overload | Options)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 420 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(420);
			expect(context.extraContext).toBe('Hello!');
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.update({ count: 420 }, { extraContext: 'Hello!' });
	});

	test('SettingsFolder#update (Events + Extra | Not Exists)', async () => {
		await settings.sync();

		const extraContext = Symbol('Hello!');
		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 420 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(schemaEntry.default);
			expect(context.changes[0].next).toBe(420);
			expect(context.extraContext).toBe(extraContext);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		client.once('settingsUpdate', unreachable);
		await settings.update('count', 420, { extraContext });
	});

	test('SettingsFolder#update (Events + Extra | Exists)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const extraContext = Symbol('Hello!');
		const schemaEntry = schema.get('count') as SchemaEntry;
		client.once('settingsCreate', unreachable);
		client.once('settingsUpdate', (emittedSettings: Settings, changes: KeyedObject, context: SettingsUpdateContext) => {
			expect(emittedSettings).toBe(settings);
			expect(changes).toEqual({ count: 420 });
			expect(context.changes.length).toBe(1);
			expect(context.changes[0].entry).toBe(schemaEntry);
			expect(context.changes[0].previous).toBe(64);
			expect(context.changes[0].next).toBe(420);
			expect(context.extraContext).toBe(extraContext);
			expect(context.guild).toBe(null);
			expect(context.language).toBe(client.languages.get('en-US'));
		});
		await settings.update('count', 420, { extraContext });
	});

	test('SettingsFolder#update (Uninitialized)', async () => {
		const settings = new SettingsFolder(new Schema());
		const updateResult = settings.update('count', 6);
		await expect(updateResult).rejects.toThrowError('Cannot update keys from a non-ready settings instance.');
	});

	test('SettingsFolder#update (Unsynchronized)', async () => {
		const updateResult = settings.update('count', 6);
		await expect(updateResult).rejects.toThrowError(
			'Cannot update keys from a pending to synchronize settings instance. Perhaps you want to call `sync()` first.'
		);
	});

	test('SettingsFolder#update (Invalid Key)', async () => {
		await provider.create(gateway.name, settings.id, { messages: { hello: 'world' } });
		await settings.sync();

		const updateResult = settings.update('invalid.path', 420);
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_KEY_NOEXT]: invalid.path');
	});

	test('SettingsFolder#update (Unconfigurable)', async () => {
		await provider.create(gateway.name, settings.id, { count: 64 });
		await settings.sync();

		const updateResult = settings.update('count', 4, { onlyConfigurable: true });
		await expect(updateResult).rejects.toThrowError('[SETTING_GATEWAY_UNCONFIGURABLE_KEY]: count');
	});

	test('SettingsFolder#toJSON', async () => {
		// Non-synced entry should have schema defaults
		expect(settings.toJSON()).toEqual({ uses: [], count: null, messages: { hello: null, ignoring: { amount: null } } });

		await provider.create(gateway.name, settings.id, { count: 123, messages: { ignoring: { amount: 420 } } });
		await settings.sync();

		// Synced entry should use synced values or schema defaults
		expect(settings.toJSON()).toEqual({ uses: [], count: 123, messages: { hello: null, ignoring: { amount: 420 } } });
	});
});

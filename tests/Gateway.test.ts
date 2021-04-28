import Collection from '@discordjs/collection';
import { RequestHandler } from '@klasa/request-handler';
import { UserStore } from 'discord.js';
import { Client as InternalClient, Gateway, GatewayStorage, Provider, Settings, SettingsExistenceStatus } from '../src';
import { createClient } from './lib/MockClient';

describe('Gateway Tests', () => {
	let client: InternalClient;

	beforeEach(() => {
		client = createClient();
	});

	afterEach(() => {
		client.destroy();
	});

	test('Gateway Properties', () => {
		const gateway = new Gateway(client, 'test', { provider: 'Mock' });

		expect(gateway instanceof GatewayStorage).toBe(true);

		expect(gateway.cache instanceof Collection).toBe(true);
		expect(gateway.cache.size).toBe(0);

		expect(gateway.requestHandler instanceof RequestHandler).toBe(true);
		expect(gateway.requestHandler.available).toBe(true);
	});

	test('Gateway (Reverse Proxy Sync)', () => {
		expect.assertions(2);

		const gateway = new Gateway(client, 'users', { provider: 'Mock' });

		expect(gateway.cache instanceof UserStore).toBe(true);
		expect(gateway.cache.size).toBe(0);
	});

	test('Gateway#get', () => {
		const gateway = new Gateway(client, 'test', { provider: 'Mock' });
		expect(gateway.get('id')).toBe(null);
	});

	test('Gateway#create', () => {
		expect.assertions(2);

		const gateway = new Gateway(client, 'test', { provider: 'Mock' });

		const created = gateway.create({ id: 'id' });
		expect(created instanceof Settings).toBe(true);
		expect(created.id).toBe('id');
	});

	test('Gateway#acquire', () => {
		expect.assertions(2);

		const gateway = new Gateway(client, 'test', { provider: 'Mock' });

		const acquired = gateway.acquire({ id: 'id' });
		expect(acquired instanceof Settings).toBe(true);
		expect(acquired.id).toBe('id');
	});

	test('Gateway#init (Table Existence In Database)', async () => {
		expect.assertions(2);

		const gateway = new Gateway(client, 'test', { provider: 'Mock' });
		const provider = gateway.provider as Provider;

		expect(await provider.hasTable(gateway.name)).toBe(false);

		await gateway.init();
		expect(await provider.hasTable(gateway.name)).toBe(true);
	});

	test('Gateway (Direct Sync | No Provider)', async () => {
		expect.assertions(2);

		client.providers.clear();

		const gateway = client.gateways.get('users') as Gateway;
		expect(gateway.provider).toBe(null);

		const settings = new Settings(gateway, { id: 'Mock' }, 'Mock');
		const syncResult = settings.sync();

		await expect(syncResult).rejects.toThrowError('Cannot run requests without a provider available.');
	});

	test('Gateway (Multiple Direct Sync | No Provider)', async () => {
		expect.assertions(2);

		client.providers.clear();

		const gateway = client.gateways.get('users') as Gateway;
		expect(gateway.provider).toBe(null);

		const settings = [
			new Settings(gateway, { id: 'Mock1' }, 'Mock1'),
			new Settings(gateway, { id: 'Mock2' }, 'Mock2'),
			new Settings(gateway, { id: 'Mock3' }, 'Mock3')
		];
		const syncResult = Promise.all(settings.map((instance) => instance.sync()));
		await expect(syncResult).rejects.toThrowError('Cannot run requests without a provider available.');
	});

	test('Gateway (Reverse Proxy Sync | With Data)', () => {
		expect.assertions(2);

		const gateway = client.gateways.get('users') as Gateway;

		client.users.add(
			{
				id: '339942739275677727',
				username: 'Dirigeants',
				avatar: null,
				discriminator: '0000'
			},
			true
		);

		const retrieved = gateway.get('339942739275677727') as Settings;
		expect(retrieved instanceof Settings).toBe(true);
		expect(retrieved.id).toBe('339942739275677727');
	});

	test('Gateway (Multiple Reverse Proxy Sync | With Data)', async () => {
		expect.assertions(6);

		const gateway = client.gateways.get('users') as Gateway;
		const provider = gateway.provider as Provider;
		gateway.schema.add('value', 'String');

		await provider.createTable('users');
		await Promise.all([provider.create('users', 'foo', { value: 'bar' }), provider.create('users', 'hello', { value: 'world' })]);

		const user1 = client.users.add(
			{
				id: 'foo',
				username: 'Dirigeants',
				avatar: null,
				discriminator: '0000'
			},
			true
		);
		const user2 = client.users.add(
			{
				id: 'hello',
				username: 'Dirigeants',
				avatar: null,
				discriminator: '0001'
			},
			true
		);
		const user3 = client.users.add(
			{
				id: 'bar',
				username: 'Dirigeants',
				avatar: null,
				discriminator: '0002'
			},
			true
		);

		const settings1 = (user1.settings as unknown) as Settings;
		const settings2 = (user2.settings as unknown) as Settings;
		const settings3 = (user3.settings as unknown) as Settings;

		expect(settings1.existenceStatus).toBe(SettingsExistenceStatus.Unsynchronized);
		expect(settings2.existenceStatus).toBe(SettingsExistenceStatus.Unsynchronized);
		expect(settings3.existenceStatus).toBe(SettingsExistenceStatus.Unsynchronized);

		await gateway.sync();

		expect(settings1.existenceStatus).toBe(SettingsExistenceStatus.Exists);
		expect(settings2.existenceStatus).toBe(SettingsExistenceStatus.Exists);
		expect(settings3.existenceStatus).toBe(SettingsExistenceStatus.NotExists);
	});
});

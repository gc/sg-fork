import { Client as InternalClient, GatewayStorage, Provider, Schema } from '../src';
import { createClient } from './lib/MockClient';

describe('GatewayStorage', () => {
	let client: InternalClient;
	let schema: Schema;

	beforeEach(() => {
		client = createClient();
		schema = new Schema();
	});

	afterEach(() => {
		client.destroy();
	});
	test('GatewayStorage Properties', () => {
		expect.assertions(9);

		const gateway = new GatewayStorage(client, 'MockGateway', { provider: 'Mock' });
		expect(gateway.client).toBe(client);
		expect(gateway.name).toBe('MockGateway');
		expect(gateway.provider).toBe(client.providers.get('Mock'));
		expect(gateway.ready).toBe(false);

		expect(gateway.schema instanceof Schema).toBe(true);
		expect(gateway.schema.size).toBe(0);
		expect(gateway.schema.path).toBe('');
		expect(gateway.schema.type).toBe('Folder');
		expect(gateway.toJSON()).toEqual({
			name: 'MockGateway',
			provider: 'Mock',
			schema: {}
		});
	});

	test('GatewayStorage#schema', () => {
		const gateway = new GatewayStorage(client, 'MockGateway', { schema });
		expect(gateway.schema).toBe(schema);
	});

	test('GatewayStorage#init', async () => {
		expect.assertions(7);

		const gateway = new GatewayStorage(client, 'MockGateway', { schema, provider: 'Mock' });
		const provider = gateway.provider as Provider;

		// Uninitialized gateway
		expect(gateway.ready).toBe(false);
		expect(gateway.schema.ready).toBe(false);
		expect(await provider.hasTable(gateway.name)).toBe(false);

		// Initialize gateway
		expect(await gateway.init()).toBe(undefined);

		// Initialized gateway
		expect(gateway.ready).toBe(true);
		expect(gateway.schema.ready).toBe(true);
		expect(await provider.hasTable(gateway.name)).toBe(true);
	});

	test('GatewayStorage#init (No Provider)', async () => {
		expect.assertions(2);

		const gateway = new GatewayStorage(client, 'MockGateway', { schema, provider: 'Mock' });
		client.providers.clear();

		expect(gateway.provider).toBe(null);
		const initResult = gateway.init();
		await expect(initResult).rejects.toThrowError('The gateway "MockGateway" could not find the provider "Mock".');
	});

	test('GatewayStorage#init (Ready)', async () => {
		const gateway = new GatewayStorage(client, 'MockGateway', { schema, provider: 'Mock' });
		await gateway.init();
		const initResult = gateway.init();
		await expect(initResult).rejects.toThrowError('The gateway "MockGateway" has already been initialized.');
	});

	test('GatewayStorage#init (Broken Schema)', async () => {
		// @ts-expect-error bypassing invalid code for test
		schema.add('key', 'String', { array: null });

		const gateway = new GatewayStorage(client, 'MockGateway', { schema, provider: 'Mock' });
		const initResult = gateway.init();
		await expect(initResult).rejects.toThrowError(
			['[SCHEMA] There is an error with your schema.', "[KEY] key - Parameter 'array' must be a boolean."].join('\n')
		);
	});

	test('GatewayStorage#sync', async () => {
		const gateway = new GatewayStorage(client, 'MockGateway', { schema, provider: 'Mock' });
		expect(await gateway.sync()).toBe(gateway);
	});
});

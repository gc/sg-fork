import Collection from '@discordjs/collection';
import { Client as InternalClient, Gateway, GatewayDriver } from '../src';
import { createClient } from './lib/MockClient';

describe('GatewayDriver', () => {
	let client: InternalClient;

	beforeEach(() => {
		client = createClient();
	});

	afterEach(() => {
		client.destroy();
	});

	test('GatewayDriver Properties', () => {
		expect.assertions(3);
		const gatewayDriver = new GatewayDriver(client);

		expect(gatewayDriver instanceof Collection).toBe(true);
		expect(gatewayDriver.client).toBe(client);

		// No gateway is registered
		expect(gatewayDriver.size).toBe(0);
	});

	test('GatewayDriver (From Client)', () => {
		expect.assertions(6);

		expect(client.gateways instanceof Collection).toBe(true);
		expect(client.gateways.client).toBe(client);

		// clientStorage, guilds, users
		expect(client.gateways.size).toBe(3);
		expect(client.gateways.get('clientStorage') instanceof Gateway).toBe(true);
		expect(client.gateways.get('guilds') instanceof Gateway).toBe(true);
		expect(client.gateways.get('users') instanceof Gateway).toBe(true);
	});

	test('GatewayDriver#register', () => {
		expect.assertions(2);
		const gateway = new Gateway(client, 'someCustomGateway');

		expect(client.gateways.register(gateway)).toBe(client.gateways);
		expect(client.gateways.get('someCustomGateway')).toBe(gateway);
	});

	test('GatewayDriver#init', async () => {
		expect.assertions(7);

		expect((client.gateways.get('guilds') as Gateway).ready).toBe(false);
		expect((client.gateways.get('users') as Gateway).ready).toBe(false);
		expect((client.gateways.get('clientStorage') as Gateway).ready).toBe(false);

		expect(await client.gateways.init()).toBe(undefined);

		expect((client.gateways.get('guilds') as Gateway).ready).toBe(true);
		expect((client.gateways.get('users') as Gateway).ready).toBe(true);
		expect((client.gateways.get('clientStorage') as Gateway).ready).toBe(true);
	});

	test('GatewayDriver#toJSON', () => {
		expect(client.gateways.toJSON()).toEqual({
			guilds: {
				name: 'guilds',
				provider: 'Mock',
				schema: {}
			},
			users: {
				name: 'users',
				provider: 'Mock',
				schema: {}
			},
			clientStorage: {
				name: 'clientStorage',
				provider: 'Mock',
				schema: {}
			}
		});
	});
});

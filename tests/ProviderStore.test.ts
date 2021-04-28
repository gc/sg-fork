import { Client as InternalClient, Client, Provider, ProviderStore } from '../src';
import { createClient } from './lib/MockClient';

describe('ProviderStore', () => {
	let client: InternalClient;

	beforeEach(() => {
		client = createClient();
	});

	afterEach(() => {
		client.destroy();
	});

	test('ProviderStore Properties', () => {
		expect.assertions(6);

		const { providers } = client;

		// Test the store's properties
		expect(providers instanceof ProviderStore).toBe(true);
		expect((providers.client as unknown) as Client).toBe(client);
		expect(providers.holds).toBe(Provider);
		expect(providers.name).toBe('providers');

		// Mock provider from tests
		expect(providers.size).toBe(1);
		expect(providers.has('Mock')).toBe(true);
	});

	test('ProviderStore#default', () => {
		expect.assertions(2);

		const { providers } = client;

		client.options.providers.default = 'Mock';
		expect(providers.default).toBe(providers.get('Mock'));
		providers.clear();
		expect(providers.default).toBe(null);
	});

	test('ProviderStore#clear', () => {
		expect.assertions(2);

		const { providers } = client;

		expect(providers.size).toBe(1);
		providers.clear();
		expect(providers.size).toBe(0);
	});

	test('ProviderStore#delete (From Name)', () => {
		expect.assertions(2);

		const { providers } = client;

		expect(providers.delete('Mock')).toBe(true);
		expect(providers.size).toBe(0);
	});

	test('ProviderStore#delete (From Instance)', () => {
		expect.assertions(2);

		const { providers } = client;

		expect(providers.delete(providers.get('Mock') as Provider)).toBe(true);
		expect(providers.size).toBe(0);
	});

	test('ProviderStore#delete (Invalid)', () => {
		expect.assertions(2);

		const { providers } = client;

		expect(providers.delete('DoesNotExist')).toBe(false);
		expect(providers.size).toBe(1);
	});
});

import { MockClient } from './lib/MockClient';

let client: MockClient;

beforeEach(() => {
	client = new MockClient();
});

afterEach(() => {
	client.destroy();
});

describe('Util', () => {
	test('Client Extensions', () => {
		expect(client.providers instanceof Map).toBe(true);
		expect(client.serializers instanceof Map).toBe(true);
		expect(client.gateways instanceof Map).toBe(true);
	});

	test('Client Providers', () => {
		const provider = client.providers.get('Mock');
		expect(typeof provider).not.toBe('undefined');
	});
});

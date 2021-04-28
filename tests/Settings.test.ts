import { Client as InternalClient, Gateway, Provider, Schema, Settings, SettingsExistenceStatus } from '../src';
import { createClient } from './lib/MockClient';

describe('Settings', () => {
	let client: InternalClient;
	let gateway: Gateway;
	let schema: Schema;
	let provider: Provider;

	beforeEach(async () => {
		client = createClient();

		schema = new Schema().add('count', 'number').add('messages', (folder) => folder.add('hello', 'string'));
		gateway = new Gateway(client, 'settings-test', {
			provider: 'Mock',
			schema
		});
		provider = gateway.provider as Provider;

		client.gateways.register(gateway);
		await gateway.init();
	});

	afterEach(() => {
		client.destroy();
	});

	test('Settings Properties', () => {
		expect.assertions(5);

		const id = '1';
		const target = { id };
		const settings = new Settings(gateway, target, id);
		expect(settings.id).toBe(id);
		expect(settings.gateway).toBe(gateway);
		expect(settings.target).toBe(target);
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.Unsynchronized);
		expect(settings.toJSON()).toEqual({
			count: null,
			messages: {
				hello: null
			}
		});
	});

	test('Settings#clone', () => {
		expect.assertions(4);

		const id = '2';
		const settings = new Settings(gateway, { id }, id);
		const clone = settings.clone();
		expect(clone instanceof Settings).toBe(true);
		expect(settings.id).toBe(clone.id);
		expect(settings.target).toBe(clone.target);
		expect(clone.toJSON()).toEqual(settings.toJSON());
	});

	test('Settings#sync (Not Exists)', async () => {
		expect.assertions(2);

		const id = '3';
		const settings = new Settings(gateway, { id }, id);

		expect(await settings.sync()).toBe(settings);
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.NotExists);
	});

	test('Settings#sync (Exists)', async () => {
		expect.assertions(7);

		const id = '4';
		await provider.create(gateway.name, id, { count: 60 });
		const settings = new Settings(gateway, { id }, id);
		settings.client.once('settingsSync', (...args) => {
			expect(args.length).toBe(1);

			const emittedSettings = (args[0] as unknown) as Settings;
			expect(emittedSettings).toBe(settings);
			expect(emittedSettings.existenceStatus).toBe(SettingsExistenceStatus.Exists);
			expect(emittedSettings.get('count')).toBe(60);
		});

		expect(await settings.sync()).toBe(settings);
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.Exists);
		expect(settings.get('count')).toBe(60);
	});

	test('Settings#destroy (Not Exists)', async () => {
		expect.assertions(2);

		const id = '5';
		const settings = new Settings(gateway, { id }, id);

		expect(await settings.destroy()).toBe(settings);
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.NotExists);
	});

	test('Settings#destroy (Exists)', async () => {
		expect.assertions(9);

		const id = '6';
		await provider.create(gateway.name, id, { count: 120 });
		const settings = new Settings(gateway, { id }, id);
		settings.client.once('settingsDelete', (...args) => {
			expect(args.length).toBe(1);

			// The emitted settings are the settings before getting reset synchronously.
			// To keep the state a little longer, synchronous code is required. Otherwise
			// the user must clone it.
			const emittedSettings = (args[0] as unknown) as Settings;
			expect(emittedSettings).toBe(settings);
			expect(emittedSettings.get('count')).toBe(120);
			expect(emittedSettings.existenceStatus).toBe(SettingsExistenceStatus.Exists);
		});

		expect(await settings.sync()).toBe(settings);
		expect(settings.get('count')).toBe(120);
		expect(await settings.destroy()).toBe(settings);
		expect(settings.existenceStatus).toBe(SettingsExistenceStatus.NotExists);
		expect(settings.get('count')).toBe(null);
	});
});

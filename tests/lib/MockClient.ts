import { ClientOptions, Structures } from 'discord.js';
import { Client } from 'klasa';
import { Client as InternalClient, Gateway, GatewayDriver, ProviderStore, SerializerStore, Settings } from '../../src';
import { MockLanguage } from './MockLanguage';
import { MockNumberSerializer } from './MockNumberSerializer';
import { MockObjectSerializer } from './MockObjectSerializer';
import { MockProvider } from './MockProvider';
import { MockStringSerializer } from './MockStringSerializer';

// @ts-ignore TS2769
Structures.extend('User', (BaseClass) => {
	return class GatewayUser extends BaseClass {
		// @ts-ignore TS2416
		public settings: Settings = ((this.client.gateways.get('users') as unknown) as Gateway).acquire(this);
	};
});

export class MockClient extends Client {
	// @ts-ignore 2416
	public providers: ProviderStore = new ProviderStore(this);

	// @ts-ignore 2416
	public serializers: SerializerStore = new SerializerStore(this);

	// @ts-ignore 2416
	public gateways: GatewayDriver = new GatewayDriver(this);

	public constructor(options: ClientOptions = {}) {
		super(options);

		this.registerStore(this.providers).registerStore(this.serializers);

		this.serializers.set(new MockStringSerializer(this.serializers, ['lib', 'MockStringSerializer'], 'dist'));
		this.serializers.set(new MockNumberSerializer(this.serializers, ['lib', 'MockNumberSerializer'], 'dist'));
		this.serializers.set(new MockObjectSerializer(this.serializers, ['lib', 'MockObjectSerializer'], 'dist'));
		this.providers.set(new MockProvider(this.providers, ['lib', 'MockProvider'], 'dist', { name: 'Mock' }));
		this.languages.set(new MockLanguage(this.languages, ['lib', 'MockLanguage'], 'dist'));
		this.gateways
			.register(new Gateway((this as unknown) as InternalClient, 'clientStorage', { provider: 'Mock' }))
			.register(new Gateway((this as unknown) as InternalClient, 'guilds', { provider: 'Mock' }))
			.register(new Gateway((this as unknown) as InternalClient, 'users', { provider: 'Mock' }));
	}
}

export function createClient(options: ClientOptions = {}): InternalClient {
	return (new MockClient(options) as unknown) as InternalClient;
}

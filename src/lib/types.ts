import type { Client as DiscordClient } from 'discord.js';
import type { GatewayDriver } from './gateway/GatewayDriver';
import type { ProviderStore } from './structures/ProviderStore';
import type { SerializerStore } from './structures/SerializerStore';

export type DeepReadonly<T extends object> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type KeyedObject = Record<PropertyKey, unknown>;
export type ReadonlyKeyedObject = DeepReadonly<KeyedObject>;

/**
 * Dummy Client made to ignore the origin's properties, so SG may compile correctly.
 * @internal
 */
export interface Client extends Omit<DiscordClient, 'gateways' | 'providers' | 'serializers'> {
	gateways: GatewayDriver;
	providers: ProviderStore;
	serializers: SerializerStore;
}

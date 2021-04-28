import Collection from '@discordjs/collection';
import { IdKeyed, RequestHandler } from '@klasa/request-handler';
import { Settings } from '../settings/Settings';
import type { Client } from '../types';
import { GatewayStorage } from './GatewayStorage';

export class Gateway extends GatewayStorage {
	/* eslint-disable no-invalid-this */
	/**
	 * The cached entries for this Gateway or the external datastore to get the settings from.
	 */
	public cache: ProxyMap =
		Reflect.has(this.client, this.name) && this.client[this.name as keyof Client] instanceof Map
			? (this.client[this.name as keyof Client] as ProxyMap)
			: new Collection<string, ProxyMapEntry>();

	/**
	 * The request handler that manages the synchronization queue.
	 */
	public requestHandler = new RequestHandler(
		(id: string): Promise<IdKeyed<string>> => {
			const { provider } = this;
			return provider === null
				? Promise.reject(new Error('Cannot run requests without a provider available.'))
				: (provider.get(this.name, id) as Promise<IdKeyed<string>>);
		},
		(ids: string[]): Promise<IdKeyed<string>[]> => {
			const { provider } = this;
			return provider === null
				? Promise.reject(new Error('Cannot run requests without a provider available.'))
				: (provider.getAll(this.name, ids) as Promise<IdKeyed<string>[]>);
		}
	);

	/* eslint-enable no-invalid-this */

	/**
	 * Gets an entry from the cache or creates one if it does not exist
	 * @param target The target that holds a Settings instance of the holder for the new one
	 * @param id The settings' identificator
	 * @example
	 * // Retrieve a members gateway
	 * const gateway = this.client.gateways.get('members');
	 *
	 * // Acquire a settings instance belonging to a member
	 * gateway.acquire(message.member);
	 */
	public acquire(target: IdKeyed<string>, id = target.id): Settings {
		return this.get(id) || this.create(target, id);
	}

	/**
	 * Get an entry from the cache.
	 * @param id The key to get from the cache
	 * @example
	 * // Retrieve a members gateway
	 * const gateway = this.client.gateways.get('members');
	 *
	 * // Retrieve a settings instance belonging to a member's id
	 * const settings = gateway.get(someMemberID);
	 *
	 * // Do something with it, be careful as it can return null
	 * if (settings === null) {
	 *     // settings is null
	 * } else {
	 *     // console.log(settings);
	 * }
	 */
	public get(id: string): Settings | null {
		const entry = this.cache.get(id);
		return (entry && entry.settings) || null;
	}

	/**
	 * Create a new Settings instance for this gateway.
	 * @param target The target that will hold this instance alive
	 * @param id The settings' identificator
	 */
	public create(target: IdKeyed<string>, id = target.id): Settings {
		const settings = new Settings(this, target, id);
		if (this.schema.size !== 0) {
			/* istanbul ignore next: Hard to coverage test the catch */
			settings.sync(true).catch((error) => this.client.emit('wtf', error));
		}
		return settings;
	}

	/**
	 * Runs a synchronization task for the gateway.
	 */
	public async sync(): Promise<this> {
		await this.requestHandler.wait();
		return this;
	}
}

export interface ProxyMapEntry {
	settings: Settings;
}

export type ProxyMap = Map<string, ProxyMapEntry>;

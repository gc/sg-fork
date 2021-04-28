import { AliasStore } from 'klasa';
import type { Client } from '../types';
import { Serializer } from './Serializer';

export class SerializerStore extends AliasStore<string, Serializer> {
	/**
	 * Constructs our SerializerStore for use in Klasa.
	 * @param client The client that instantiates this store
	 */
	public constructor(client: Client) {
		// @ts-ignore 2345
		super(client, 'serializers', Serializer);
	}
}

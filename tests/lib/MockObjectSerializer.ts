import { Serializer, SerializerStore } from '../../src';

export class MockObjectSerializer extends Serializer {
	public constructor(store: SerializerStore, file: string[], directory: string) {
		super(store, file, directory, { name: 'object' });
	}

	public resolve(data: unknown): unknown {
		return data === null ? null : { data };
	}
}

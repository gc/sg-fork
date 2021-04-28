import { mergeObjects } from '@klasa/utils';
import { Provider, SettingsUpdateResults } from '../../src';

export class MockProvider extends Provider {
	private tables = new Map<string, Map<string, Record<PropertyKey, unknown>>>();

	public async createTable(table: string): Promise<void> {
		if (this.tables.has(table)) throw new Error('Table Exists');
		this.tables.set(table, new Map());
	}

	public async deleteTable(table: string): Promise<void> {
		if (!this.tables.has(table)) throw new Error('Table Not Exists');
		this.tables.delete(table);
	}

	public async hasTable(table: string): Promise<boolean> {
		return this.tables.has(table);
	}

	public async create(table: string, entry: string, data: Record<PropertyKey, unknown> | SettingsUpdateResults): Promise<void> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');
		if (resolvedTable.has(entry)) throw new Error('Entry Exists');
		resolvedTable.set(entry, { ...this.parseUpdateInput(data), id: entry });
	}

	public async delete(table: string, entry: string): Promise<void> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');
		if (!resolvedTable.has(entry)) throw new Error('Entry Not Exists');
		resolvedTable.delete(entry);
	}

	public async get(table: string, entry: string): Promise<Record<PropertyKey, unknown> | null> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');
		return resolvedTable.get(entry) || null;
	}

	public async getAll(table: string, entries?: readonly string[]): Promise<Record<PropertyKey, unknown>[]> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');

		if (typeof entries === 'undefined') {
			return [...resolvedTable.values()];
		}

		const values: Record<PropertyKey, unknown>[] = [];
		for (const [key, value] of resolvedTable.entries()) {
			if (entries.includes(key)) values.push(value);
		}

		return values;
	}

	public async getKeys(table: string): Promise<string[]> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');
		return [...resolvedTable.keys()];
	}

	public async has(table: string, entry: string): Promise<boolean> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');
		return resolvedTable.has(entry);
	}

	public async update(table: string, entry: string, data: Record<PropertyKey, unknown> | SettingsUpdateResults): Promise<void> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');

		const resolvedEntry = resolvedTable.get(entry);
		if (typeof resolvedEntry === 'undefined') throw new Error('Entry Not Exists');

		resolvedTable.set(entry, mergeObjects({ ...resolvedEntry }, this.parseUpdateInput(data)));
	}

	public async replace(table: string, entry: string, data: Record<PropertyKey, unknown> | SettingsUpdateResults): Promise<void> {
		const resolvedTable = this.tables.get(table);
		if (typeof resolvedTable === 'undefined') throw new Error('Table Not Exists');

		const resolvedEntry = resolvedTable.get(entry);
		if (typeof resolvedEntry === 'undefined') throw new Error('Entry Not Exists');

		resolvedTable.set(entry, { ...this.parseUpdateInput(data), id: entry });
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Database } from './database.js';

export const IDatabaseSyncService = createDecorator<IDatabaseSyncService>('databaseSyncService');

export interface IDatabaseSyncService {
	readonly _serviceBrand: undefined;
	enqueueSync(resource: URI, db: Database): Promise<void>;
}

class NoopDatabaseSyncService implements IDatabaseSyncService {
	declare readonly _serviceBrand: undefined;
	private readonly _queues = new Map<string, Promise<void>>();

	async enqueueSync(resource: URI, db: Database): Promise<void> {
		const key = db.id || resource.toString();
		const previous = this._queues.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this._syncToSupabase(resource, db));
		this._queues.set(key, next);
		try {
			await next;
		} finally {
			if (this._queues.get(key) === next) {
				this._queues.delete(key);
			}
		}
	}

	private async _syncToSupabase(resource: URI, db: Database): Promise<void> {
		const config = getSupabaseConfig();
		if (!config) {
			return;
		}

		const endpoint = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?on_conflict=db_id`;
		const payload = [{
			db_id: db.id,
			name: db.name,
			resource: resource.toString(),
			payload: db,
			updated_at: new Date().toISOString(),
		}];

		const headers: Record<string, string> = {
			'apikey': config.anonKey,
			'Authorization': `Bearer ${config.anonKey}`,
			'Content-Type': 'application/json',
			'Prefer': 'resolution=merge-duplicates,return=minimal',
		};

		let lastError: unknown;
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers,
					body: JSON.stringify(payload),
				});
				if (response.ok) {
					return;
				}
				lastError = new Error(`Supabase sync failed: ${response.status} ${response.statusText}`);
			} catch (error) {
				lastError = error;
			}
			await delay(250 * Math.pow(2, attempt));
		}
		if (lastError) {
			// Keep local edits unblocked while surfacing background sync failures.
			console.warn('[database-sync] Supabase push failed', lastError);
		}
	}
}

interface SupabaseSyncConfig {
	url: string;
	anonKey: string;
	table: string;
}

function getSupabaseConfig(): SupabaseSyncConfig | undefined {
	const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const storage = (globalThis as { localStorage?: Storage }).localStorage;

	const url = (storage?.getItem('database.supabase.url')
		?? storage?.getItem('genzen.database.supabase.url')
		?? env?.DATABASE_SUPABASE_URL
		?? env?.SUPABASE_URL
		?? env?.GENZEN_SUPABASE_URL
		?? '').trim().replace(/\/+$/, '');
	const anonKey = (storage?.getItem('database.supabase.anonKey')
		?? storage?.getItem('genzen.database.supabase.anonKey')
		?? env?.DATABASE_SUPABASE_ANON_KEY
		?? env?.SUPABASE_ANON_KEY
		?? env?.GENZEN_SUPABASE_ANON_KEY
		?? '').trim();
	const table = (storage?.getItem('database.supabase.table')
		?? storage?.getItem('genzen.database.supabase.table')
		?? env?.DATABASE_SUPABASE_TABLE
		?? env?.SUPABASE_TABLE
		?? env?.GENZEN_SUPABASE_TABLE
		?? 'database_documents').trim();

	if (!url || !anonKey || !table) {
		return undefined;
	}
	return { url, anonKey, table };
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

registerSingleton(IDatabaseSyncService, NoopDatabaseSyncService, InstantiationType.Delayed);

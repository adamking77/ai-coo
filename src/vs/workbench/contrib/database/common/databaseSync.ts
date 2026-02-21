/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRequestService, asText } from '../../../../platform/request/common/request.js';
import { Database } from './database.js';

export const IDatabaseSyncService = createDecorator<IDatabaseSyncService>('databaseSyncService');

export type DatabaseSyncState = 'syncing' | 'synced' | 'error' | 'disabled';

export interface DatabaseSyncStatus {
	key: string;
	state: DatabaseSyncState;
	timestamp: number;
	errorMessage?: string;
}

export interface IDatabaseSyncService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeStatus: Event<DatabaseSyncStatus>;
	enqueueSync(resource: URI, db: Database): Promise<void>;
	getStatus(key: string): DatabaseSyncStatus | undefined;
}

class NoopDatabaseSyncService implements IDatabaseSyncService {
	declare readonly _serviceBrand: undefined;
	private readonly _queues = new Map<string, Promise<void>>();
	private readonly _statuses = new Map<string, DatabaseSyncStatus>();
	private readonly _onDidChangeStatus = new Emitter<DatabaseSyncStatus>();
	readonly onDidChangeStatus: Event<DatabaseSyncStatus> = this._onDidChangeStatus.event;

	constructor(
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) { }

	getStatus(key: string): DatabaseSyncStatus | undefined {
		return this._statuses.get(key);
	}

	async enqueueSync(resource: URI, db: Database): Promise<void> {
		const key = db.id || resource.toString();
		const previous = this._queues.get(key) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this._syncToSupabase(key, resource, db));
		this._queues.set(key, next);
		try {
			await next;
		} finally {
			if (this._queues.get(key) === next) {
				this._queues.delete(key);
			}
		}
	}

	private async _syncToSupabase(key: string, resource: URI, db: Database): Promise<void> {
		this.updateStatus(key, 'syncing');
		const config = getSupabaseConfig(this.logService, this.configurationService);
		if (!config) {
			this.updateStatus(key, 'disabled');
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
				const response = await this.requestService.request({
					type: 'POST',
					url: endpoint,
					headers,
					data: JSON.stringify(payload),
					timeout: 10000,
				}, CancellationToken.None);
				const statusCode = response.res.statusCode ?? 0;
				if (statusCode >= 200 && statusCode < 300) {
					this.updateStatus(key, 'synced');
					return;
				}
				const responseText = await asText(response);
				lastError = new Error(`Supabase sync failed: ${statusCode}${responseText ? ` ${responseText}` : ''}`);
			} catch (error) {
				lastError = error;
			}
			await delay(250 * Math.pow(2, attempt));
		}
		if (lastError) {
			// Keep local edits unblocked while surfacing background sync failures.
			this.logService.warn('[database-sync] Supabase push failed', lastError);
			this.updateStatus(key, 'error', lastError instanceof Error ? lastError.message : String(lastError));
		}
	}

	private updateStatus(key: string, state: DatabaseSyncState, errorMessage?: string): void {
		const status: DatabaseSyncStatus = {
			key,
			state,
			timestamp: Date.now(),
			errorMessage,
		};
		this._statuses.set(key, status);
		this._onDidChangeStatus.fire(status);
	}
}

interface SupabaseSyncConfig {
	url: string;
	anonKey: string;
	table: string;
}

let hasLoggedMissingSupabaseConfig = false;

function getSupabaseConfig(logService: ILogService | undefined, configurationService: IConfigurationService): SupabaseSyncConfig | undefined {
	const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const storage = (globalThis as { localStorage?: Storage }).localStorage;
	const configuredUrl = configurationService.getValue<string>('database.supabase.url');
	const configuredAnonKey = configurationService.getValue<string>('database.supabase.anonKey');
	const configuredTable = configurationService.getValue<string>('database.supabase.table');

	// Prefer environment variables so local machine config in .env.local remains the source of truth.
	const rawUrl = firstNonEmpty(
		configuredUrl,
		env?.DATABASE_SUPABASE_URL,
		env?.SUPABASE_URL,
		env?.GENZEN_SUPABASE_URL,
		storage?.getItem('database.supabase.url'),
		storage?.getItem('genzen.database.supabase.url')
	);
	const url = rawUrl?.replace(/\/+$/, '');
	const anonKey = firstNonEmpty(
		configuredAnonKey,
		env?.DATABASE_SUPABASE_ANON_KEY,
		env?.SUPABASE_ANON_KEY,
		env?.GENZEN_SUPABASE_ANON_KEY,
		storage?.getItem('database.supabase.anonKey'),
		storage?.getItem('genzen.database.supabase.anonKey')
	);
	const table = firstNonEmpty(
		configuredTable,
		env?.DATABASE_SUPABASE_TABLE,
		env?.SUPABASE_TABLE,
		env?.GENZEN_SUPABASE_TABLE,
		storage?.getItem('database.supabase.table'),
		storage?.getItem('genzen.database.supabase.table'),
		'database_documents'
	);

	if (!url || !anonKey || !table) {
		if (!hasLoggedMissingSupabaseConfig) {
			hasLoggedMissingSupabaseConfig = true;
			logService?.info('[database-sync] Supabase sync disabled: missing url, anon key, or table config. Set database.supabase.* settings or provide env vars.');
		}
		return undefined;
	}
	hasLoggedMissingSupabaseConfig = false;
	return { url, anonKey, table };
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) {
			return trimmed;
		}
	}
	return undefined;
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

registerSingleton(IDatabaseSyncService, NoopDatabaseSyncService, InstantiationType.Delayed);

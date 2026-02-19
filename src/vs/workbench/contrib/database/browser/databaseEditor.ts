/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { FileChangeType, IFileService } from '../../../../platform/files/common/files.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { DatabaseEditorInput } from './databaseEditorInput.js';
import { IDatabaseService } from './databaseService.js';
import { Database, DBRecord, DBView, Field, inferImplicitRelationTargets, STATUS_OPTIONS, ViewType } from '../common/database.js';
import { renderTable } from './tableView.js';
import { renderKanban } from './kanbanView.js';
import { renderList } from './listView.js';
import { renderGallery } from './galleryView.js';
import { renderCalendar } from './calendarView.js';
import { showSortPanel, showFilterPanel } from './sortFilterPanel.js';
import { showSchemaEditor } from './schemaEditor.js';
import { showRecordEditor, RecordEditorCallbacks } from './recordEditor.js';
import { injectDatabaseStyles } from './databaseStyles.js';

const VIEW_ICONS: Record<ViewType, string> = {
	table: '▦',
	kanban: '▤',
	list: '☰',
	gallery: '⊞',
	calendar: '🗓',
};

const VIEW_DEFAULT_NAMES: Record<ViewType, string> = {
	table: 'Table',
	kanban: 'Kanban',
	list: 'List',
	gallery: 'Gallery',
	calendar: 'Calendar',
};

export class DatabaseEditor extends EditorPane {

	static readonly ID = 'workbench.editor.database';

	private root!: HTMLElement;
	private toolbarEl!: HTMLElement;
	private contentEl!: HTMLElement;
	private errorEl!: HTMLElement;

	private inputResource: DatabaseEditorInput | null = null;
	private db: Database | null = null;
	private activeViewId: string | null = null;
	private activeRecordId: string | null = null;
	private workspaceDatabases = new Map<string, Database>();
	private workspaceDatabaseUris = new Map<string, URI>();

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IDatabaseService private readonly databaseService: IDatabaseService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService fileService: IFileService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(DatabaseEditor.ID, group, telemetryService, themeService, storageService);
		this._register(themeService.onDidColorThemeChange(() => {
			if (this.db) {
				this.render();
			}
		}));
		this._register(fileService.onDidFilesChange(e => {
			if (this.inputResource && e.contains(this.getDatabaseResource(this.inputResource.resource), FileChangeType.UPDATED, FileChangeType.ADDED)) {
				void this.loadDatabase();
			}
		}));
	}

	protected override createEditor(parent: HTMLElement): void {
		injectDatabaseStyles();
		this.root = append(parent, $('div.db-editor-root'));
		this.toolbarEl = append(this.root, $('div.db-toolbar'));
		this.contentEl = append(this.root, $('div.db-content.db-editor-content'));
		this.errorEl = append(this.root, $('div.db-empty-state'));
		this.errorEl.style.display = 'none';
	}

	override layout(dimension: Dimension): void {
		if (this.root) {
			this.root.style.height = `${dimension.height}px`;
		}
	}

	override async setInput(input: DatabaseEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.inputResource = input;
		await this.loadDatabase();
	}

	override clearInput(): void {
		this.db = null;
		this.activeViewId = null;
		this.activeRecordId = null;
		clearNode(this.toolbarEl);
		clearNode(this.contentEl);
		this.hideError();
		super.clearInput();
	}

	override focus(): void {
		this.contentEl?.focus();
	}

	private async loadDatabase(): Promise<void> {
		if (!this.inputResource) {
			return;
		}
		try {
			const previousViewId = this.activeViewId;
			this.db = await this.databaseService.readDatabase(this.getDatabaseResource(this.inputResource.resource));
			const discovered = await this.databaseService.scanWorkspace();
			this.workspaceDatabases.clear();
			this.workspaceDatabaseUris.clear();
			for (const entry of discovered) {
				this.workspaceDatabases.set(entry.db.id, entry.db);
				this.workspaceDatabaseUris.set(entry.db.id, entry.uri);
			}
			this.workspaceDatabases.set(this.db.id, this.db);
			this.workspaceDatabaseUris.set(this.db.id, this.getDatabaseResource(this.inputResource.resource));
			if (inferImplicitRelationTargets(this.db, this.workspaceDatabases.values())) {
				void this.save();
			}
			const hasPreviousView = previousViewId ? this.db.views.some(view => view.id === previousViewId) : false;
			this.activeViewId = hasPreviousView ? previousViewId : (this.db.views[0]?.id ?? null);
			this.activeRecordId = this.getRecordIdFromResource(this.inputResource.resource);
			this.hideError();
			this.render();
		} catch (error) {
			this.db = null;
			this.activeViewId = null;
			this.renderError(localize('database.openError', "Unable to open this database file."));
			this.notificationService.error(error instanceof Error ? error.message : localize('database.openErrorUnknown', "Failed to open database."));
		}
	}

	private render(): void {
		clearNode(this.toolbarEl);
		clearNode(this.contentEl);
		if (!this.db || !this.activeViewId) {
			const empty = append(this.contentEl, $('div.db-empty-state'));
			empty.textContent = localize('database.empty', 'This database has no views. Add a view to begin.');
			return;
		}
		if (this.activeRecordId) {
			const record = this.db.records.find(candidate => candidate.id === this.activeRecordId);
			if (!record) {
				const empty = append(this.contentEl, $('div.db-empty-state'));
				empty.textContent = localize('database.recordMissing', 'Record not found.');
				return;
			}
			this.editRecord(record, 'fullpage');
			return;
		}

		const activeView = this.db.views.find(v => v.id === this.activeViewId);
		if (!activeView) {
			return;
		}

		const tabs = append(this.toolbarEl, $('div.db-tabs'));
		for (const view of this.db.views) {
			const wrapper = append(tabs, $('div.db-tab-wrapper'));
			const tabBtn = append(wrapper, $('button.db-tab'));
			tabBtn.textContent = VIEW_ICONS[view.type] + ' ' + view.name;
			if (view.id === this.activeViewId) {
				tabBtn.classList.add('db-tab--active');
			}
			tabBtn.addEventListener('click', () => {
				this.activeViewId = view.id;
				this.render();
			});
			tabBtn.addEventListener('dblclick', (e) => {
				e.stopPropagation();
				this.renameViewInline(tabBtn, view);
			});

			if (this.db.views.length > 1) {
				const closeBtn = append(wrapper, $('button.db-tab-close'));
				closeBtn.textContent = '×';
				closeBtn.title = localize('database.deleteView', 'Delete view');
				closeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.deleteView(view);
				});
			}
		}

		const addViewBtn = append(tabs, $('button.db-add-view-btn'));
		addViewBtn.textContent = '+';
		addViewBtn.title = localize('database.addView', 'Add view');
		addViewBtn.addEventListener('click', () => this.showAddViewMenu(addViewBtn));

		append(this.toolbarEl, $('span.db-toolbar-spacer'));

		const filterBtn = append(this.toolbarEl, $('button.db-btn'));
		filterBtn.textContent = localize('database.filter', 'Filter');
		if (activeView.filter.length) {
			filterBtn.classList.add('db-btn-active');
		}
		filterBtn.addEventListener('click', () => {
			showFilterPanel(filterBtn, this.db!, activeView, () => {
				void this.save();
				this.render();
			});
		});

		const sortBtn = append(this.toolbarEl, $('button.db-btn'));
		sortBtn.textContent = localize('database.sort', 'Sort');
		if (activeView.sort.length) {
			sortBtn.classList.add('db-btn-active');
		}
		sortBtn.addEventListener('click', () => {
			showSortPanel(sortBtn, this.db!, activeView, () => {
				void this.save();
				this.render();
			});
		});

		const schemaBtn = append(this.toolbarEl, $('button.db-btn'));
		schemaBtn.textContent = localize('database.manageFields', '⚙ Fields');
		schemaBtn.addEventListener('click', () => this.openSchemaEditor());

		const addRecordBtn = append(this.toolbarEl, $('button.db-btn.db-btn-primary'));
		addRecordBtn.textContent = localize('database.addRecord', '+ Record');
		addRecordBtn.addEventListener('click', () => this.addRecord());

		if (activeView.type === 'table') {
			renderTable(this.contentEl, this.db, activeView.id, {
				onRecordClick: (record) => this.editRecord(record),
				onCellEdit: (recordId, fieldId, value) => this.updateCell(recordId, fieldId, value),
				onAddRecord: () => this.addRecord(),
				onDuplicateRecord: (record) => this.duplicateRecord(record),
				onDeleteRecord: (record) => this.deleteRecord(record),
				onAddField: (name, type) => this.addField(name, type),
				onUpdateField: (field) => this.updateField(field),
				onColumnWidthChange: (fieldId, width) => this.saveColumnWidth(fieldId, width),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (activeView.type === 'kanban') {
			renderKanban(this.contentEl, this.db, activeView.id, {
				onRecordClick: (record) => this.editRecord(record),
				onRecordMove: (recordId, fieldId, newValue) => this.updateCell(recordId, fieldId, newValue),
				onAddRecord: (groupValue) => this.addRecord(groupValue),
				onDuplicateRecord: (record) => this.duplicateRecord(record),
				onDeleteRecord: (record) => this.deleteRecord(record),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (activeView.type === 'list') {
			renderList(this.contentEl, this.db, activeView.id, {
				onRecordClick: (record) => this.editRecord(record),
				onAddRecord: () => this.addRecord(),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (activeView.type === 'calendar') {
			renderCalendar(this.contentEl, this.db, activeView.id, {
				onRecordClick: (record) => this.editRecord(record),
				onAddRecord: (dateValue?: string) => this.addRecord(undefined, dateValue),
			});
		} else {
			renderGallery(this.contentEl, this.db, activeView.id, {
				onRecordClick: (record) => this.editRecord(record),
				onAddRecord: () => this.addRecord(),
				resolveDatabase: this._resolveDatabase,
			});
		}
	}

	private renameViewInline(tabButton: HTMLElement, view: DBView): void {
		const input = document.createElement('input');
		input.className = 'db-input db-tab-rename-input';
		input.value = view.name;
		tabButton.replaceWith(input);
		input.focus();
		input.select();

		const commit = () => {
			view.name = input.value.trim() || view.name;
			void this.save();
			this.render();
		};

		input.addEventListener('blur', commit);
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') {
				input.blur();
			}
			if (e.key === 'Escape') {
				this.render();
			}
		});
	}

	private deleteView(view: DBView): void {
		if (!this.db || this.db.views.length <= 1) {
			return;
		}
		const index = this.db.views.indexOf(view);
		if (index < 0) {
			return;
		}
		this.db.views.splice(index, 1);
		if (this.activeViewId === view.id) {
			this.activeViewId = this.db.views[0]?.id ?? null;
		}
		void this.save();
		this.render();
	}

	private showAddViewMenu(anchor: HTMLElement): void {
		document.querySelectorAll('.db-context-menu').forEach(el => el.remove());
		const menu = document.createElement('div');
		menu.className = 'db-context-menu';
		document.body.appendChild(menu);
		const rect = anchor.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 4}px`;
		menu.style.left = `${rect.left}px`;

		const viewTypes: Array<{ type: ViewType; label: string }> = [
			{ type: 'table', label: '▦ Table' },
			{ type: 'kanban', label: '▤ Kanban' },
			{ type: 'list', label: '☰ List' },
			{ type: 'gallery', label: '⊞ Gallery' },
			{ type: 'calendar', label: '🗓 Calendar' },
		];

		for (const { type, label } of viewTypes) {
			const item = append(menu, $('div.db-context-menu-item'));
			item.textContent = label;
			item.addEventListener('click', () => {
				menu.remove();
				this.addView(type);
			});
		}

		const close = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', close);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', close), 0);
	}

	private addView(type: ViewType): void {
		if (!this.db) {
			return;
		}
		const newView: DBView = {
			id: generateUuid(),
			name: VIEW_DEFAULT_NAMES[type],
			type,
			sort: [],
			filter: [],
			hiddenFields: [],
		};
		if (type === 'kanban' || type === 'gallery') {
			const groupField = this.db.schema.find(f => f.type === 'status' || f.type === 'select');
			if (groupField) {
				newView.groupBy = groupField.id;
			}
		}
		if (type === 'calendar') {
			const dateField = this.db.schema.find(f => f.type === 'date');
			if (dateField) {
				newView.groupBy = dateField.id;
			}
		}
		this.db.views.push(newView);
		this.activeViewId = newView.id;
		void this.save();
		this.render();
	}

	private addRecord(presetGroupValue?: string, presetDateValue?: string): void {
		if (!this.db) {
			return;
		}
		const now = new Date().toISOString();
		const record: DBRecord = { id: generateUuid() };
		for (const field of this.db.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				record[field.id] = now;
			} else if (field.type === 'relation') {
				record[field.id] = [];
			} else {
				record[field.id] = null;
			}
		}
		if (presetGroupValue !== undefined && this.activeViewId) {
			const view = this.db.views.find(v => v.id === this.activeViewId);
			if (view?.groupBy) {
				record[view.groupBy] = presetGroupValue;
			}
		}
		if (presetDateValue && this.activeViewId) {
			const view = this.db.views.find(v => v.id === this.activeViewId);
			const dateField = view?.groupBy ? this.db.schema.find(field => field.id === view.groupBy && field.type === 'date') : this.db.schema.find(field => field.type === 'date');
			if (dateField) {
				record[dateField.id] = presetDateValue;
			}
		}
		this.db.records.push(record);
		void this.save();
		this.render();
		this.editRecord(record);
	}

	private editRecord(record: DBRecord, mode: 'panel' | 'fullpage' = 'panel'): void {
		if (!this.db) {
			return;
		}
		const callbacks: RecordEditorCallbacks = {
			onSave: updated => {
				const editedField = this.db!.schema.find(f => f.type === 'lastEditedAt');
				if (editedField) {
					updated[editedField.id] = new Date().toISOString();
				}
				const index = this.db!.records.findIndex(r => r.id === updated.id);
				if (index >= 0) {
					this.db!.records[index] = updated;
				}
				void this.save();
				this.render();
			},
			onDelete: rec => this.deleteRecord(rec),
			onDuplicate: rec => this.duplicateRecord(rec),
			onOpenFullPage: rec => { void this.openRecordAsFullPage(rec.id); },
			onCreateRelatedRecord: async (relationFieldId, targetDatabaseId, title, sourceRecordId) => this.createRelatedRecord(relationFieldId, targetDatabaseId, title, sourceRecordId),
			onOpenRelatedRecord: async (databaseId, recordId, options) => this.openRelatedRecord(databaseId, recordId, options),
			onClose: () => {
				if (mode === 'fullpage') {
					void this.openDatabaseInCurrentTab();
				}
			},
		};
		const target = mode === 'fullpage' ? this.contentEl : this.root;
		showRecordEditor(target, record, this.db, callbacks, this._resolveDatabase, mode);
	}

	private duplicateRecord(record: DBRecord): void {
		if (!this.db) {
			return;
		}
		const now = new Date().toISOString();
		const duplicate: DBRecord = { ...record, id: generateUuid() };
		for (const field of this.db.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				duplicate[field.id] = now;
			}
		}
		const index = this.db.records.findIndex(r => r.id === record.id);
		this.db.records.splice(index + 1, 0, duplicate);
		void this.save();
		this.render();
	}

	private deleteRecord(record: DBRecord): void {
		if (!this.db) {
			return;
		}
		const index = this.db.records.findIndex(r => r.id === record.id);
		if (index >= 0) {
			this.db.records.splice(index, 1);
		}
		void this.save();
		this.render();
	}

	private updateCell(recordId: string, fieldId: string, value: string | number | boolean | string[] | null): void {
		if (!this.db) {
			return;
		}
		const record = this.db.records.find(r => r.id === recordId);
		if (!record) {
			return;
		}
		record[fieldId] = value;
		const editedField = this.db.schema.find(f => f.type === 'lastEditedAt');
		if (editedField) {
			record[editedField.id] = new Date().toISOString();
		}
		void this.save();
	}

	private addField(name: string, type: Field['type']): void {
		if (!this.db) {
			return;
		}
		const newField: Field = { id: generateUuid(), name, type };
		if (type === 'status') {
			newField.options = [...STATUS_OPTIONS];
		}
		if (type === 'relation') {
			newField.relation = {};
		}
		if (type === 'rollup') {
			newField.rollup = { relationFieldId: '', aggregation: 'count' };
		}
		if (type === 'formula') {
			newField.formula = { expression: '' };
		}
		this.db.schema.push(newField);
		for (const record of this.db.records) {
			if (!(newField.id in record)) {
				record[newField.id] = null;
			}
		}
		void this.save();
		this.render();
	}

	private updateField(updatedField: Field): void {
		if (!this.db) {
			return;
		}
		const index = this.db.schema.findIndex(field => field.id === updatedField.id);
		if (index < 0) {
			return;
		}
		const sanitizedOptions = updatedField.options?.map(option => option.trim()).filter(Boolean) ?? [];
		const optionColors: Record<string, string> = {};
		for (const option of sanitizedOptions) {
			const color = updatedField.optionColors?.[option];
			if (color) {
				optionColors[option] = color;
			}
		}
		this.db.schema[index] = {
			...updatedField,
			options: sanitizedOptions.length ? sanitizedOptions : undefined,
			optionColors: Object.keys(optionColors).length ? optionColors : undefined,
		};
		void this.save();
		this.render();
	}

	private saveColumnWidth(fieldId: string, width: number): void {
		if (!this.db || !this.activeViewId) {
			return;
		}
		const view = this.db.views.find(v => v.id === this.activeViewId);
		if (!view) {
			return;
		}
		if (!view.columnWidths) {
			view.columnWidths = {};
		}
		view.columnWidths[fieldId] = width;
		void this.save();
	}

	private openSchemaEditor(): void {
		if (!this.db) {
			return;
		}
		showSchemaEditor(
			this.root,
			this.db,
			newSchema => {
				this.databaseService.migrateSchema(this.db!, newSchema);
				void this.save();
				this.render();
			},
			() => { },
			{
				databases: [...this.workspaceDatabases.values()].map(database => ({ id: database.id, name: database.name })),
				relationFieldsByDatabaseId: this._getRelationFieldsByDatabaseId(),
				fieldsByDatabaseId: this._getFieldsByDatabaseId(),
				currentView: this.activeViewId ? this.db.views.find(view => view.id === this.activeViewId) : undefined,
			},
		);
	}

	private async save(): Promise<void> {
		if (!this.db || !this.inputResource) {
			return;
		}
		try {
			await this.databaseService.saveDatabase(this.db, this.getDatabaseResource(this.inputResource.resource));
		} catch (error) {
			this.notificationService.error(error instanceof Error ? error.message : localize('database.saveFailed', 'Failed to save database.'));
		}
	}

	private getDatabaseResource(resource: URI): URI {
		return resource.with({ fragment: '', query: '' });
	}

	private getRecordIdFromResource(resource: URI): string | null {
		const prefix = 'record=';
		if (!resource.fragment?.startsWith(prefix)) {
			const query = resource.query ?? '';
			if (query.startsWith(prefix)) {
				return decodeURIComponent(query.slice(prefix.length));
			}
			return null;
		}
		return decodeURIComponent(resource.fragment.slice(prefix.length));
	}

	private async openRecordAsFullPage(recordId: string): Promise<void> {
		if (!this.inputResource) {
			return;
		}
		const base = this.getDatabaseResource(this.inputResource.resource);
		const encoded = encodeURIComponent(recordId);
		const resource = base.with({ query: `record=${encoded}`, fragment: `record=${encoded}` });
		await this.editorService.openEditor({
			resource,
			options: {
				pinned: true,
				revealIfOpened: true,
				override: DatabaseEditorInput.ID,
			},
		});
	}

	private async openDatabaseInCurrentTab(): Promise<void> {
		if (!this.inputResource) {
			return;
		}
		await this.editorService.openEditor({
			resource: this.getDatabaseResource(this.inputResource.resource),
			options: {
				pinned: true,
				revealIfOpened: true,
				override: DatabaseEditorInput.ID,
			},
		});
	}

	private async openRelatedRecord(databaseId: string, recordId: string, options?: { newTab?: boolean }): Promise<void> {
		const uri = this.workspaceDatabaseUris.get(databaseId);
		if (!uri) {
			return;
		}
		const encoded = encodeURIComponent(recordId);
		const resource = uri.with({ query: `record=${encoded}`, fragment: `record=${encoded}` });
		if (!options?.newTab) {
			await this.editorService.openEditor({
				resource,
				options: {
					pinned: false,
					revealIfOpened: true,
					override: DatabaseEditorInput.ID,
				},
			}, this.group.id);
			return;
		}
		await this.editorService.openEditor({
			resource,
			options: {
				pinned: true,
				revealIfOpened: true,
				override: DatabaseEditorInput.ID,
			},
		}, this.group.id);
	}

	private async createRelatedRecord(relationFieldId: string, targetDatabaseId: string, title: string, sourceRecordId: string): Promise<string | undefined> {
		if (!this.db || !this.inputResource) {
			return undefined;
		}
		const relationField = this.db.schema.find(field => field.id === relationFieldId && field.type === 'relation');
		if (!relationField) {
			return undefined;
		}
		const targetDb = this.workspaceDatabases.get(targetDatabaseId);
		const targetUri = this.workspaceDatabaseUris.get(targetDatabaseId);
		if (!targetDb || !targetUri) {
			return undefined;
		}
		const now = new Date().toISOString();
		const newRecord: DBRecord = { id: generateUuid() };
		for (const field of targetDb.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				newRecord[field.id] = now;
			} else if (field.type === 'relation') {
				newRecord[field.id] = [];
			} else {
				newRecord[field.id] = null;
			}
		}
		const titleField = targetDb.schema.find(field => field.type === 'text');
		if (titleField) {
			newRecord[titleField.id] = title;
		}
		const backlinkFieldId = relationField.relation?.targetRelationFieldId;
		if (backlinkFieldId) {
			const backlinkField = targetDb.schema.find(field => field.id === backlinkFieldId && field.type === 'relation');
			if (backlinkField) {
				newRecord[backlinkField.id] = [sourceRecordId];
			}
		}
		targetDb.records.push(newRecord);
		await this.databaseService.saveDatabase(targetDb, targetUri);
		const source = this.db.records.find(record => record.id === sourceRecordId);
		if (source) {
			const existing = new Set<string>(Array.isArray(source[relationFieldId]) ? (source[relationFieldId] as string[]) : []);
			existing.add(newRecord.id);
			source[relationFieldId] = [...existing];
			await this.databaseService.saveDatabase(this.db, this.getDatabaseResource(this.inputResource.resource));
		}
		return newRecord.id;
	}

	private renderError(message: string): void {
		this.errorEl.textContent = message;
		this.errorEl.style.display = '';
		clearNode(this.toolbarEl);
		clearNode(this.contentEl);
	}

	private hideError(): void {
		this.errorEl.textContent = '';
		this.errorEl.style.display = 'none';
	}

	private readonly _resolveDatabase = (databaseId: string): Database | undefined => {
		return this.workspaceDatabases.get(databaseId);
	};

	private _getRelationFieldsByDatabaseId(): Record<string, Array<{ id: string; name: string }>> {
		const result: Record<string, Array<{ id: string; name: string }>> = {};
		for (const database of this.workspaceDatabases.values()) {
			result[database.id] = database.schema
				.filter(field => field.type === 'relation')
				.map(field => ({ id: field.id, name: field.name }));
		}
		return result;
	}

	private _getFieldsByDatabaseId(): Record<string, Array<{ id: string; name: string; type: Field['type'] }>> {
		const result: Record<string, Array<{ id: string; name: string; type: Field['type'] }>> = {};
		for (const database of this.workspaceDatabases.values()) {
			result[database.id] = database.schema
				.map(field => ({ id: field.id, name: field.name, type: field.type }));
		}
		return result;
	}
}

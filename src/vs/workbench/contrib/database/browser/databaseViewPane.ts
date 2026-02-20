/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { URI } from '../../../../base/common/uri.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IDatabaseService } from './databaseService.js';
import { Database, DBRecord, DBView, ViewType, Field, inferImplicitRelationTargets, STATUS_OPTIONS } from '../common/database.js';
import { renderTable } from './tableView.js';
import { renderKanban } from './kanbanView.js';
import { renderList } from './listView.js';
import { renderGallery } from './galleryView.js';
import { renderCalendar } from './calendarView.js';
import { showSchemaEditor } from './schemaEditor.js';
import { showRecordEditor, RecordEditorCallbacks } from './recordEditor.js';
import { showSortPanel, showFilterPanel } from './sortFilterPanel.js';
import { injectDatabaseStyles } from './databaseStyles.js';
import { DatabaseEditorInput } from './databaseEditorInput.js';
import { appendDatabaseOverlay } from './overlayHost.js';

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

export class DatabaseViewPane extends ViewPane {

	private leftPanel!: HTMLElement;
	private rightPanel!: HTMLElement;
	private dbListEl!: HTMLElement;
	private dbToolbar!: HTMLElement;
	private contentArea!: HTMLElement;

	private databases: Array<{ db: Database; uri: URI }> = [];
	private selectedDb: Database | null = null;
	private selectedUri: URI | null = null;
	private activeViewId: string | null = null;

	constructor(
		options: IViewPaneOptions,
		@IDatabaseService private readonly databaseService: IDatabaseService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(themeService.onDidColorThemeChange(() => {
			this._renderDbList();
			if (this.selectedDb) {
				this._renderToolbar();
				this._renderContent();
			}
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		injectDatabaseStyles();

		container.classList.add('db-container');

		this.leftPanel = append(container, $('div.db-left'));
		this._buildLeftPanel();

		this.rightPanel = append(container, $('div.db-right'));
		this._buildRightPanel();
		this.rightPanel.style.display = 'none';

		this._refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.leftPanel.style.width = `${width}px`;
	}

	// ─── Left Panel ───────────────────────────────────────────────────────────

	private _buildLeftPanel(): void {
		clearNode(this.leftPanel);

		const header = append(this.leftPanel, $('div.db-left-header'));
		const title = append(header, $('span.db-left-title'));
		title.textContent = 'Databases';

		const actions = append(header, $('div.db-left-actions'));

		const newBtn = append(actions, $('button.db-icon-btn'));
		newBtn.title = 'New Database';
		newBtn.classList.add('codicon', 'codicon-add');
		newBtn.addEventListener('click', () => this._createDatabase());

		const openBtn = append(actions, $('button.db-icon-btn'));
		openBtn.title = 'Open .db.json file';
		openBtn.classList.add('codicon', 'codicon-folder-opened');
		openBtn.addEventListener('click', () => this._openFile());

		const refreshBtn = append(actions, $('button.db-icon-btn'));
		refreshBtn.title = 'Refresh';
		refreshBtn.classList.add('codicon', 'codicon-refresh');
		refreshBtn.addEventListener('click', () => this._refresh());

		this.dbListEl = append(this.leftPanel, $('div.db-list'));
		this._renderDbList();
	}

	private _renderDbList(): void {
		clearNode(this.dbListEl);
		if (this.databases.length === 0) {
			const empty = append(this.dbListEl, $('div.db-list-empty'));
			empty.textContent = 'No .db.json files found';
			return;
		}
		for (const { db, uri } of this.databases) {
			const item = append(this.dbListEl, $('div.db-list-item'));
			item.title = uri.fsPath;
			if (this.selectedUri?.toString() === uri.toString()) {
				item.classList.add('db-list-item--active');
			}

			append(item, $('span.db-list-icon.codicon.codicon-database'));

			const name = append(item, $('span.db-list-name'));
			name.textContent = db.name;
			name.addEventListener('dblclick', (e) => {
				e.stopPropagation();
				this._renameDbInline(name, db);
			});

			const count = append(item, $('span.db-list-count'));
			count.textContent = String(db.records.length);

			const menuBtn = append(item, $('button.db-list-menu-btn'));
			menuBtn.classList.add('codicon', 'codicon-ellipsis');
			menuBtn.title = 'Options';
			menuBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this._showDbContextMenu(e, db, uri);
			});

			item.addEventListener('click', () => {
				this._selectDb(db, uri);
				void this._openDbInEditor(uri);
			});
		}
	}

	private _renameDbInline(nameEl: HTMLElement, db: Database): void {
		const input = document.createElement('input');
		input.className = 'db-input db-list-rename-input';
		input.value = db.name;
		nameEl.replaceWith(input);
		input.focus();
		input.select();
		const commit = () => {
			db.name = input.value.trim() || db.name;
			this._save();
			this._renderDbList();
		};
		input.addEventListener('blur', commit);
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') { input.blur(); }
			if (e.key === 'Escape') { this._renderDbList(); }
		});
	}

	private _showDbContextMenu(e: MouseEvent, db: Database, uri: URI): void {
		document.querySelectorAll('.db-context-menu').forEach(el => el.remove());
		const menu = document.createElement('div');
		menu.className = 'db-context-menu';
		const anchor = e.currentTarget instanceof HTMLElement ? e.currentTarget : this.element;
		appendDatabaseOverlay(menu, anchor);
		menu.style.top = `${e.clientY}px`;
		menu.style.left = `${e.clientX}px`;

		const items: Array<{ label: string; danger?: boolean; action: () => void }> = [
			{
				label: 'Open in Editor',
				action: () => { void this._openDbInEditor(uri); },
			},
			{
				label: 'Duplicate',
				action: async () => {
					const folders = this.workspaceService.getWorkspace().folders;
					if (!folders.length) { return; }
					const { db: newDb, uri: newUri } = await this.databaseService.duplicateDatabase(db, uri, folders[0].uri);
					this.databases.push({ db: newDb, uri: newUri });
					this._renderDbList();
				},
			},
			{
				label: 'Export CSV',
				action: () => this._exportCsv(db),
			},
			{
				label: 'Import CSV',
				action: () => this._importCsv(db),
			},
			{
				label: 'Delete',
				danger: true,
				action: async () => {
					if (confirm(`Delete "${db.name}"? This cannot be undone.`)) {
						await this.databaseService.deleteDatabase(uri);
						this.databases = this.databases.filter(d => d.uri.toString() !== uri.toString());
						if (this.selectedUri?.toString() === uri.toString()) {
							this.selectedDb = null;
							this.selectedUri = null;
							this.activeViewId = null;
							this._renderEmptyState();
						}
						this._renderDbList();
					}
				},
			},
		];

		for (const item of items) {
			const el = append(menu, $('div.db-context-menu-item'));
			el.textContent = item.label;
			if (item.danger) { el.classList.add('db-context-menu-item--danger'); }
			el.addEventListener('click', () => { menu.remove(); item.action(); });
		}

		const close = (ev: MouseEvent) => {
			if (!menu.contains(ev.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', close);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', close), 0);
	}

	// ─── Right Panel ──────────────────────────────────────────────────────────

	private _buildRightPanel(): void {
		clearNode(this.rightPanel);
		this.dbToolbar = append(this.rightPanel, $('div.db-toolbar'));
		this.contentArea = append(this.rightPanel, $('div.db-content'));
		this._renderEmptyState();
	}

	private _renderEmptyState(): void {
		clearNode(this.dbToolbar);
		clearNode(this.contentArea);
		const msg = append(this.contentArea, $('div.db-empty-state'));
		msg.textContent = 'Select a database or create a new one.';
	}

	private _renderToolbar(): void {
		clearNode(this.dbToolbar);
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const activeView = db.views.find(v => v.id === this.activeViewId);

		// View tabs
		const tabs = append(this.dbToolbar, $('div.db-tabs'));
		for (const view of db.views) {
			const wrapper = append(tabs, $('div.db-tab-wrapper'));

			const tabBtn = append(wrapper, $('button.db-tab'));
			tabBtn.textContent = VIEW_ICONS[view.type] + ' ' + view.name;
			tabBtn.title = view.type;
			if (view.id === this.activeViewId) { tabBtn.classList.add('db-tab--active'); }
			tabBtn.addEventListener('click', () => {
				this.activeViewId = view.id;
				this._renderContent();
				this._renderToolbar();
			});
			tabBtn.addEventListener('dblclick', (e) => {
				e.stopPropagation();
				this._renameViewInline(tabBtn, view);
			});

			if (db.views.length > 1) {
				const closeTab = append(wrapper, $('button.db-tab-close'));
				closeTab.textContent = '×';
				closeTab.title = 'Delete view';
				closeTab.addEventListener('click', (e) => {
					e.stopPropagation();
					this._deleteView(view);
				});
			}
		}

		// Add view
		const addViewBtn = append(tabs, $('button.db-add-view-btn'));
		addViewBtn.textContent = '+';
		addViewBtn.title = 'Add view';
		addViewBtn.addEventListener('click', () => this._showAddViewMenu(addViewBtn));

		append(this.dbToolbar, $('span.db-toolbar-spacer'));

		// Filter
		const filterBtn = append(this.dbToolbar, $('button.db-btn'));
		filterBtn.textContent = 'Filter';
		if (activeView?.filter.length) { filterBtn.classList.add('db-btn-active'); }
		filterBtn.addEventListener('click', () => {
			if (!activeView) { return; }
			showFilterPanel(filterBtn, db, activeView, () => {
				this._save();
				this._renderContent();
				this._renderToolbar();
			});
		});

		// Sort
		const sortBtn = append(this.dbToolbar, $('button.db-btn'));
		sortBtn.textContent = 'Sort';
		if (activeView?.sort.length) { sortBtn.classList.add('db-btn-active'); }
		sortBtn.addEventListener('click', () => {
			if (!activeView) { return; }
			showSortPanel(sortBtn, db, activeView, () => {
				this._save();
				this._renderContent();
			});
		});

		// Schema
		const schemaBtn = append(this.dbToolbar, $('button.db-btn'));
		schemaBtn.textContent = '⚙ Fields';
		schemaBtn.addEventListener('click', () => this._openSchema());

		// Add record
		const addBtn = append(this.dbToolbar, $('button.db-btn.db-btn-primary'));
		addBtn.textContent = '+ Record';
		addBtn.addEventListener('click', () => this._addRecord());

	}

	private _renameViewInline(tabBtn: HTMLElement, view: DBView): void {
		const input = document.createElement('input');
		input.className = 'db-input db-tab-rename-input';
		input.value = view.name;
		tabBtn.replaceWith(input);
		input.focus();
		input.select();
		const commit = () => {
			view.name = input.value.trim() || view.name;
			this._save();
			this._renderToolbar();
		};
		input.addEventListener('blur', commit);
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') { input.blur(); }
			if (e.key === 'Escape') { this._renderToolbar(); }
		});
	}

	private _deleteView(view: DBView): void {
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const idx = db.views.indexOf(view);
		if (idx < 0 || db.views.length <= 1) { return; }
		db.views.splice(idx, 1);
		if (this.activeViewId === view.id) { this.activeViewId = db.views[0].id; }
		this._save();
		this._renderToolbar();
		this._renderContent();
	}

	private _showAddViewMenu(anchor: HTMLElement): void {
		document.querySelectorAll('.db-context-menu').forEach(el => el.remove());
		const menu = document.createElement('div');
		menu.className = 'db-context-menu';
		appendDatabaseOverlay(menu, anchor);
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
			item.addEventListener('click', () => { menu.remove(); this._addView(type); });
		}

		const close = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('mousedown', close);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', close), 0);
	}

	private _addView(type: ViewType): void {
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const newView: DBView = {
			id: generateUuid(),
			name: VIEW_DEFAULT_NAMES[type],
			type,
			sort: [],
			filter: [],
			hiddenFields: [],
		};
		if (type === 'kanban' || type === 'gallery') {
			const groupField = db.schema.find(f => f.type === 'status' || f.type === 'select');
			if (groupField) { newView.groupBy = groupField.id; }
		}
		if (type === 'calendar') {
			const dateField = db.schema.find(f => f.type === 'date');
			if (dateField) { newView.groupBy = dateField.id; }
		}
		db.views.push(newView);
		this.activeViewId = newView.id;
		this._save();
		this._renderToolbar();
		this._renderContent();
	}

	private _renderContent(): void {
		clearNode(this.contentArea);
		if (!this.selectedDb || !this.activeViewId) { return; }

		const db = this.selectedDb;
		const view = db.views.find(v => v.id === this.activeViewId);
		if (!view) { return; }

		if (view.type === 'table') {
			renderTable(this.contentArea, db, view.id, {
				onRecordClick: (record) => this._editRecord(record),
				onCellEdit: (recordId, fieldId, value) => this._updateCell(recordId, fieldId, value),
				onAddRecord: () => this._addRecord(),
				onDuplicateRecord: (record) => this._duplicateRecord(record),
				onDeleteRecord: (record) => this._deleteRecord(record),
				onAddField: (name, type) => this._addField(name, type),
				onUpdateField: (field) => this._updateField(field),
				onColumnWidthChange: (fieldId, width) => this._saveColumnWidth(fieldId, width),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (view.type === 'kanban') {
			renderKanban(this.contentArea, db, view.id, {
				onRecordClick: (record) => this._editRecord(record),
				onRecordMove: (recordId, fieldId, newValue) => this._updateCell(recordId, fieldId, newValue),
				onAddRecord: (groupValue) => this._addRecord(groupValue),
				onDuplicateRecord: (record) => this._duplicateRecord(record),
				onDeleteRecord: (record) => this._deleteRecord(record),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (view.type === 'list') {
			renderList(this.contentArea, db, view.id, {
				onRecordClick: (record) => this._editRecord(record),
				onAddRecord: () => this._addRecord(),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (view.type === 'gallery') {
			renderGallery(this.contentArea, db, view.id, {
				onRecordClick: (record) => this._editRecord(record),
				onAddRecord: () => this._addRecord(),
				resolveDatabase: this._resolveDatabase,
			});
		} else if (view.type === 'calendar') {
			renderCalendar(this.contentArea, db, view.id, {
				onRecordClick: (record) => this._editRecord(record),
				onAddRecord: (dateValue?: string) => this._addRecord(undefined, dateValue),
			});
		}
	}

	// ─── Actions ──────────────────────────────────────────────────────────────

	private async _refresh(): Promise<void> {
		this.databases = await this.databaseService.scanWorkspace();
		this._renderDbList();
		if (this.selectedUri) {
			const found = this.databases.find(d => d.uri.toString() === this.selectedUri!.toString());
			if (found) {
				this.selectedDb = found.db;
				this._renderContent();
			}
		}
	}

	private async _openFile(): Promise<void> {
		const uris = await this.fileDialogService.showOpenDialog({
			filters: [{ name: 'Database', extensions: ['json'] }],
			canSelectMany: false,
			canSelectFiles: true,
			canSelectFolders: false,
		});
		if (!uris?.length) { return; }
		try {
			const db = await this.databaseService.readDatabase(uris[0]);
			const existing = this.databases.find(d => d.uri.toString() === uris[0].toString());
			if (!existing) { this.databases.push({ db, uri: uris[0] }); }
			this._selectDb(db, uris[0]);
			await this._openDbInEditor(uris[0]);
		} catch { /* ignore bad files */ }
	}

	private _selectDb(db: Database, uri: URI): void {
		if (inferImplicitRelationTargets(db, this.databases.map(entry => entry.db))) {
			void this.databaseService.saveDatabase(db, uri).catch(() => { /* best-effort relation normalization */ });
		}
		this.selectedDb = db;
		this.selectedUri = uri;
		this.activeViewId = db.views[0]?.id ?? null;
		this._renderDbList();
	}

	private async _createDatabase(): Promise<void> {
		const folders = this.workspaceService.getWorkspace().folders;
		if (!folders.length) { return; }
		clearNode(this.dbListEl);
		const form = append(this.dbListEl, $('div.db-new-form'));
		const input = append(form, $('input.db-input')) as HTMLInputElement;
		input.placeholder = 'Database name';
		const btnRow = append(form, $('div.db-new-form-btns'));
		const createBtn = append(btnRow, $('button.db-btn.db-btn-primary'));
		createBtn.textContent = 'Create';
		const cancelBtn = append(btnRow, $('button.db-btn'));
		cancelBtn.textContent = 'Cancel';

		cancelBtn.addEventListener('click', () => this._renderDbList());
		createBtn.addEventListener('click', async () => {
			const name = input.value.trim();
			if (!name) { input.focus(); return; }
			const { db, uri } = await this.databaseService.createDatabase(name, folders[0].uri);
			this.databases.push({ db, uri });
			this._selectDb(db, uri);
			await this._openDbInEditor(uri);
		});

		input.focus();
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') { createBtn.click(); }
			if (e.key === 'Escape') { this._renderDbList(); }
		});
	}

	private _addRecord(presetGroupValue?: string, presetDateValue?: string): void {
		if (!this.selectedDb || !this.selectedUri) { return; }
		const db = this.selectedDb;
		const now = new Date().toISOString();

		const record: DBRecord = { id: generateUuid() };
		for (const field of db.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				record[field.id] = now;
			} else if (field.type === 'relation') {
				record[field.id] = [];
			} else {
				record[field.id] = null;
			}
		}

		if (presetGroupValue !== undefined && this.activeViewId) {
			const view = db.views.find(v => v.id === this.activeViewId);
			if (view?.groupBy) { record[view.groupBy] = presetGroupValue; }
		}
		if (presetDateValue && this.activeViewId) {
			const view = db.views.find(v => v.id === this.activeViewId);
			const dateField = view?.groupBy ? db.schema.find(field => field.id === view.groupBy && field.type === 'date') : db.schema.find(field => field.type === 'date');
			if (dateField) { record[dateField.id] = presetDateValue; }
		}

		db.records.push(record);
		this._save();
		this._renderContent();
		this._editRecord(record);
	}

	private _editRecord(record: DBRecord): void {
		if (!this.selectedDb || !this.selectedUri) { return; }
		const db = this.selectedDb;
		const callbacks: RecordEditorCallbacks = {
			onSave: (updated) => {
				// Update lastEditedAt
				const editedField = db.schema.find(f => f.type === 'lastEditedAt');
				if (editedField) { updated[editedField.id] = new Date().toISOString(); }
				const idx = db.records.findIndex(r => r.id === updated.id);
				if (idx >= 0) { db.records[idx] = updated; }
				this._save();
				this._renderContent();
				this._renderDbList();
			},
			onDelete: (rec) => this._deleteRecord(rec),
			onDuplicate: (rec) => this._duplicateRecord(rec),
			onCreateRelatedRecord: async (relationFieldId, targetDatabaseId, title, sourceRecordId) => this._createRelatedRecord(relationFieldId, targetDatabaseId, title, sourceRecordId),
			onOpenRelatedRecord: async (databaseId, recordId, options) => this._openRelatedRecord(databaseId, recordId, options),
			onUpdateRelatedRecord: async (databaseId, recordId, fieldId, value) => this._updateRelatedRecord(databaseId, recordId, fieldId, value),
			onUpdateHeaderFields: async fieldIds => this._updateHeaderFields(fieldIds),
			onClose: () => { /* nothing */ },
		};
		showRecordEditor(this.rightPanel, record, db, callbacks, this._resolveDatabase);
	}

	private _duplicateRecord(record: DBRecord): void {
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const now = new Date().toISOString();
		const dup: DBRecord = { ...record, id: generateUuid() };
		for (const field of db.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				dup[field.id] = now;
			}
		}
		const idx = db.records.findIndex(r => r.id === record.id);
		db.records.splice(idx + 1, 0, dup);
		this._save();
		this._renderContent();
	}

	private _deleteRecord(record: DBRecord): void {
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const idx = db.records.findIndex(r => r.id === record.id);
		if (idx >= 0) { db.records.splice(idx, 1); }
		this._save();
		this._renderContent();
		this._renderDbList();
	}

	private _updateCell(recordId: string, fieldId: string, value: string | number | boolean | string[] | null): void {
		if (!this.selectedDb || !this.selectedUri) { return; }
		const db = this.selectedDb;
		const record = db.records.find(r => r.id === recordId);
		if (record) {
			record[fieldId] = value;
			const editedField = db.schema.find(f => f.type === 'lastEditedAt');
			if (editedField) { record[editedField.id] = new Date().toISOString(); }
			this._save();
			const view = db.views.find(v => v.id === this.activeViewId);
			if (view?.type === 'kanban' || view?.type === 'gallery') { this._renderContent(); }
		}
	}

	private _addField(name: string, type: Field['type']): void {
		if (!this.selectedDb) { return; }
		const db = this.selectedDb;
		const newField: Field = { id: generateUuid(), name, type };
		if (type === 'status') { newField.options = [...STATUS_OPTIONS]; }
		if (type === 'relation') { newField.relation = {}; }
		if (type === 'rollup') { newField.rollup = { relationFieldId: '', aggregation: 'count' }; }
		if (type === 'formula') { newField.formula = { expression: '' }; }
		db.schema.push(newField);
		for (const record of db.records) {
			if (!(newField.id in record)) { record[newField.id] = null; }
		}
		this._save();
		this._renderContent();
	}

	private _updateField(updatedField: Field): void {
		if (!this.selectedDb) { return; }
		const index = this.selectedDb.schema.findIndex(field => field.id === updatedField.id);
		if (index < 0) { return; }
		const sanitizedOptions = updatedField.options?.map(option => option.trim()).filter(Boolean) ?? [];
		const optionColors: Record<string, string> = {};
		for (const option of sanitizedOptions) {
			const color = updatedField.optionColors?.[option];
			if (color) {
				optionColors[option] = color;
			}
		}
		this.selectedDb.schema[index] = {
			...updatedField,
			options: sanitizedOptions.length ? sanitizedOptions : undefined,
			optionColors: Object.keys(optionColors).length ? optionColors : undefined,
		};
		this._save();
		this._renderContent();
	}

	private _saveColumnWidth(fieldId: string, width: number): void {
		if (!this.selectedDb || !this.activeViewId) { return; }
		const view = this.selectedDb.views.find(v => v.id === this.activeViewId);
		if (!view) { return; }
		if (!view.columnWidths) { view.columnWidths = {}; }
		view.columnWidths[fieldId] = width;
		this._save();
	}

	private _openSchema(): void {
		if (!this.selectedDb || !this.selectedUri) { return; }
		showSchemaEditor(
			this.rightPanel,
			this.selectedDb,
			(newSchema) => {
				this.databaseService.migrateSchema(this.selectedDb!, newSchema);
				this._save();
				this._renderContent();
			},
			() => { /* closed */ },
			{
				databases: this.databases.map(entry => ({ id: entry.db.id, name: entry.db.name })),
				relationFieldsByDatabaseId: this._getRelationFieldsByDatabaseId(),
				fieldsByDatabaseId: this._getFieldsByDatabaseId(),
				currentView: this.activeViewId ? this.selectedDb.views.find(view => view.id === this.activeViewId) : undefined,
			},
		);
	}

	private async _exportCsv(db: Database): Promise<void> {
		const csv = this.databaseService.exportCsv(db);
		const blob = new Blob([csv], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `${db.name}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	private async _importCsv(db: Database): Promise<void> {
		const uris = await this.fileDialogService.showOpenDialog({
			filters: [{ name: 'CSV', extensions: ['csv'] }],
			canSelectMany: false,
			canSelectFiles: true,
			canSelectFolders: false,
		});
		if (!uris?.length) { return; }
		try {
			const response = await fetch(uris[0].toString(true));
			const text = await response.text();
			const firstLine = text.split(/\r?\n/)[0] ?? '';
			const csvHeaders = firstLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
			const fieldMap: Record<string, string> = {};
			for (const header of csvHeaders) {
				const match = db.schema.find(f => f.name.toLowerCase() === header.toLowerCase());
				if (match) { fieldMap[header] = match.id; }
			}
			const newRecords = this.databaseService.importCsvRecords(db, text, fieldMap);
			db.records.push(...newRecords);
			this._save();
			this._renderContent();
			this._renderDbList();
		} catch { /* ignore bad files */ }
	}

	private _save(): void {
		if (this.selectedDb && this.selectedUri) {
			void this.databaseService.saveDatabase(this.selectedDb, this.selectedUri).catch(() => { /* ignore save error in sidebar pane */ });
		}
	}

	private async _openDbInEditor(uri: URI): Promise<void> {
		await this.editorService.openEditor({
			resource: uri,
			options: {
				pinned: true,
				revealIfOpened: true,
				override: DatabaseEditorInput.ID,
			},
		});
	}

	private async _openRelatedRecord(databaseId: string, recordId: string, options?: { newTab?: boolean }): Promise<void> {
		const entry = this.databases.find(candidate => candidate.db.id === databaseId);
		if (!entry) {
			return;
		}
		const encoded = encodeURIComponent(recordId);
		await this.editorService.openEditor({
			resource: entry.uri.with({ query: `record=${encoded}`, fragment: `record=${encoded}` }),
			options: {
				pinned: Boolean(options?.newTab),
				revealIfOpened: true,
				override: DatabaseEditorInput.ID,
			},
		});
	}

	private async _createRelatedRecord(relationFieldId: string, targetDatabaseId: string, title: string, sourceRecordId: string): Promise<string | undefined> {
		if (!this.selectedDb) {
			return undefined;
		}
		const relationField = this.selectedDb.schema.find(field => field.id === relationFieldId && field.type === 'relation');
		if (!relationField) {
			return undefined;
		}
		const targetEntry = this.databases.find(entry => entry.db.id === targetDatabaseId);
		if (!targetEntry) {
			return undefined;
		}
		const now = new Date().toISOString();
		const newRecord: DBRecord = { id: generateUuid() };
		for (const field of targetEntry.db.schema) {
			if (field.type === 'createdAt' || field.type === 'lastEditedAt') {
				newRecord[field.id] = now;
			} else if (field.type === 'relation') {
				newRecord[field.id] = [];
			} else {
				newRecord[field.id] = null;
			}
		}
		const titleField = targetEntry.db.schema.find(field => field.type === 'text');
		if (titleField) {
			newRecord[titleField.id] = title;
		}
		const backlinkFieldId = relationField.relation?.targetRelationFieldId;
		if (backlinkFieldId) {
			const backlinkField = targetEntry.db.schema.find(field => field.id === backlinkFieldId && field.type === 'relation');
			if (backlinkField) {
				newRecord[backlinkField.id] = [sourceRecordId];
			}
		}
		targetEntry.db.records.push(newRecord);
		await this.databaseService.saveDatabase(targetEntry.db, targetEntry.uri);
		const source = this.selectedDb.records.find(record => record.id === sourceRecordId);
		if (source && this.selectedUri) {
			const existing = new Set<string>(Array.isArray(source[relationFieldId]) ? (source[relationFieldId] as string[]) : []);
			existing.add(newRecord.id);
			source[relationFieldId] = [...existing];
			await this.databaseService.saveDatabase(this.selectedDb, this.selectedUri);
		}
		return newRecord.id;
	}

	private async _updateRelatedRecord(databaseId: string, recordId: string, fieldId: string, value: string | number | boolean | string[] | null): Promise<void> {
		const targetEntry = this.databases.find(entry => entry.db.id === databaseId);
		if (!targetEntry) {
			return;
		}
		const targetRecord = targetEntry.db.records.find(record => record.id === recordId);
		if (!targetRecord) {
			return;
		}
		targetRecord[fieldId] = value;
		const editedField = targetEntry.db.schema.find(field => field.type === 'lastEditedAt');
		if (editedField) {
			targetRecord[editedField.id] = new Date().toISOString();
		}
		await this.databaseService.saveDatabase(targetEntry.db, targetEntry.uri);
		if (this.selectedDb?.id === databaseId) {
			this._renderContent();
		}
	}

	private async _updateHeaderFields(fieldIds: string[]): Promise<void> {
		if (!this.selectedDb) {
			return;
		}
		this.selectedDb.headerFieldIds = [...fieldIds];
		this._save();
	}

	private readonly _resolveDatabase = (databaseId: string): Database | undefined => {
		return this.databases.find(entry => entry.db.id === databaseId)?.db;
	};

	private _getRelationFieldsByDatabaseId(): Record<string, Array<{ id: string; name: string }>> {
		const result: Record<string, Array<{ id: string; name: string }>> = {};
		for (const entry of this.databases) {
			result[entry.db.id] = entry.db.schema
				.filter(field => field.type === 'relation')
				.map(field => ({ id: field.id, name: field.name }));
		}
		return result;
	}

	private _getFieldsByDatabaseId(): Record<string, Array<{ id: string; name: string; type: Field['type'] }>> {
		const result: Record<string, Array<{ id: string; name: string; type: Field['type'] }>> = {};
		for (const entry of this.databases) {
			result[entry.db.id] = entry.db.schema
				.map(field => ({ id: field.id, name: field.name, type: field.type }));
		}
		return result;
	}
}

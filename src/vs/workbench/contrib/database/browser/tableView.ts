/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DatabaseResolver, DBRecord, Field, DBView, getVisibleFields, applySorts, applyFilters, getStatusColor, STATUS_OPTIONS, getFieldValue, getRecordTitle, getRelationTargetDatabase, getFieldOptionColor, getReadableTextColor } from '../common/database.js';
import { appendDatabaseOverlay } from './overlayHost.js';

export interface TableViewOptions {
	onRecordClick: (record: DBRecord) => void;
	onCellEdit: (recordId: string, fieldId: string, value: string | number | boolean | string[] | null) => void;
	onAddRecord: () => void;
	onDuplicateRecord: (record: DBRecord) => void;
	onDeleteRecord: (record: DBRecord) => void;
	onAddField: (name: string, type: Field['type']) => void;
	onUpdateField: (field: Field) => void;
	onColumnWidthChange: (fieldId: string, width: number) => void;
	resolveDatabase?: DatabaseResolver;
}

// ─── Cell Rendering ───────────────────────────────────────────────────────────

function renderCellValue(cell: HTMLElement, record: DBRecord, field: Field, db: Database, resolveDatabase?: DatabaseResolver): void {
	clearNode(cell);
	const val = getFieldValue(record, field, db, resolveDatabase);

	if (field.type === 'checkbox') {
		const cb = append(cell, $('input')) as HTMLInputElement;
		cb.type = 'checkbox';
		cb.className = 'db-cell-checkbox';
		cb.checked = Boolean(val);
		cb.addEventListener('click', e => e.stopPropagation());
		return;
	}

	if (field.type === 'status' && val) {
		const badge = append(cell, $('span.db-status-badge'));
		badge.textContent = String(val);
		badge.style.backgroundColor = getStatusColor(String(val));
		return;
	}

	if (field.type === 'select' && val) {
		const badge = append(cell, $('span.db-select-badge'));
		badge.textContent = String(val);
		const bg = getFieldOptionColor(field, String(val));
		badge.style.backgroundColor = bg;
		badge.style.color = getReadableTextColor(bg);
		return;
	}

	if (field.type === 'multiselect' && Array.isArray(val) && val.length) {
		const wrap = append(cell, $('span'));
		for (const v of val) {
			const badge = append(wrap, $('span.db-select-badge'));
			badge.textContent = v;
			const bg = getFieldOptionColor(field, v);
			badge.style.backgroundColor = bg;
			badge.style.color = getReadableTextColor(bg);
		}
		return;
	}

	if (field.type === 'relation' && Array.isArray(val) && val.length) {
		const wrap = append(cell, $('span'));
		const targetDb = getRelationTargetDatabase(db, field, resolveDatabase);
		for (const recordId of val) {
			const linked = targetDb.records.find(candidate => candidate.id === recordId);
			const badge = append(wrap, $('span.db-select-badge'));
			badge.textContent = linked ? getRecordTitle(linked, targetDb.schema) : String(recordId);
		}
		return;
	}

	if (field.type === 'url' && val) {
		const link = append(cell, $('a.db-cell-link')) as HTMLAnchorElement;
		link.href = String(val);
		link.textContent = String(val);
		link.target = '_blank';
		link.addEventListener('click', e => e.stopPropagation());
		return;
	}

	if (field.type === 'email' && val) {
		const link = append(cell, $('a.db-cell-link')) as HTMLAnchorElement;
		link.href = `mailto:${val}`;
		link.textContent = String(val);
		link.addEventListener('click', e => e.stopPropagation());
		return;
	}

	if (field.type === 'phone' && val) {
		const link = append(cell, $('a.db-cell-link')) as HTMLAnchorElement;
		link.href = `tel:${val}`;
		link.textContent = String(val);
		link.addEventListener('click', e => e.stopPropagation());
		return;
	}

	if ((field.type === 'createdAt' || field.type === 'lastEditedAt') && val) {
		const span = append(cell, $('span.db-cell-display'));
		try { span.textContent = new Date(String(val)).toLocaleDateString(); } catch { span.textContent = String(val); }
		return;
	}

	const display = append(cell, $('span.db-cell-display'));
	display.textContent = val != null ? String(val) : '';
}

// ─── Cell Editor ─────────────────────────────────────────────────────────────

function openCellEditor(
	cell: HTMLElement,
	record: DBRecord,
	field: Field,
	db: Database,
	resolveDatabase: DatabaseResolver | undefined,
	onCommit: (value: string | number | boolean | string[] | null) => void,
): void {
	if (field.type === 'createdAt' || field.type === 'lastEditedAt' || field.type === 'rollup' || field.type === 'formula') { return; }
	const val = record[field.id];

	if ((field.type === 'select' || field.type === 'status') && (field.options?.length || field.type === 'status')) {
		const options = field.type === 'status' ? (field.options ?? STATUS_OPTIONS) : (field.options ?? []);
		showTableOptionPicker(cell, {
			multi: false,
			options: options.map((option, index) => ({
				id: option,
				label: option,
				color: getFieldOptionColor(field, option) ?? OPTION_COLOR_PRESETS[index % OPTION_COLOR_PRESETS.length].value,
			})),
			selected: typeof val === 'string' && val ? [val] : [],
			groupStatus: field.type === 'status',
			onChange: selected => {
				onCommit(selected[0] ?? null);
			},
			onClear: () => onCommit(null),
		});
		return;
	}

	if (field.type === 'multiselect' && field.options?.length) {
		showTableOptionPicker(cell, {
			multi: true,
			options: field.options.map((option, index) => ({
				id: option,
				label: option,
				color: getFieldOptionColor(field, option) ?? OPTION_COLOR_PRESETS[index % OPTION_COLOR_PRESETS.length].value,
			})),
			selected: Array.isArray(val) ? val.filter((item): item is string => typeof item === 'string') : [],
			onChange: selected => onCommit(selected),
			onClear: () => onCommit([]),
		});
		return;
	}

	clearNode(cell);
	if (field.type === 'checkbox') {
		const cb = append(cell, $('input')) as HTMLInputElement;
		cb.type = 'checkbox';
		cb.className = 'db-cell-checkbox';
		cb.checked = Boolean(val);
		cb.focus();
		cb.addEventListener('change', () => onCommit(cb.checked));
		return;
	}

	if (field.type === 'relation') {
		const selected = new Set<string>(Array.isArray(val) ? val : []);
		const overlay = append(cell, $('div.db-multiselect-editor'));
		const targetDb = getRelationTargetDatabase(db, field, resolveDatabase);
		const candidates = targetDb.records.filter(candidate => !(targetDb.id === db.id && candidate.id === record.id));
		for (const candidate of candidates) {
			const row = append(overlay, $('label.db-multiselect-row'));
			const cb = append(row, $('input')) as HTMLInputElement;
			cb.type = 'checkbox';
			cb.checked = selected.has(candidate.id);
			cb.addEventListener('change', () => {
				if (cb.checked) { selected.add(candidate.id); } else { selected.delete(candidate.id); }
			});
			const lbl = append(row, $('span'));
			lbl.textContent = getRecordTitle(candidate, targetDb.schema);
		}
		const doneBtn = append(overlay, $('button.db-btn.db-btn-primary'));
		doneBtn.textContent = 'Done';
		doneBtn.addEventListener('click', () => onCommit([...selected]));
		return;
	}

	const inputType =
		field.type === 'number' ? 'number' :
		field.type === 'date' ? 'date' :
		field.type === 'url' ? 'url' :
		field.type === 'email' ? 'email' :
		field.type === 'phone' ? 'tel' : 'text';

	const input = append(cell, $('input.db-cell-editor')) as HTMLInputElement;
	input.type = inputType;
	input.value = val != null ? String(val) : '';
	input.focus();
	input.select();

	const commit = () => {
		const raw = input.value;
		if (field.type === 'number') {
			onCommit(raw === '' ? null : Number(raw));
		} else {
			onCommit(raw || null);
		}
	};
	input.addEventListener('blur', commit);
	input.addEventListener('keydown', e => {
		if (e.key === 'Enter') { input.blur(); }
		if (e.key === 'Escape') { onCommit(val ?? null); e.stopPropagation(); }
	});
}

interface TablePickerOption {
	id: string;
	label: string;
	color?: string;
}

interface TablePickerOptions {
	multi: boolean;
	options: TablePickerOption[];
	selected: string[];
	onChange: (selected: string[]) => void;
	onClear?: () => void;
	groupStatus?: boolean;
}

function getStatusSection(label: string): 'To-do' | 'In progress' | 'Complete' {
	const normalized = label.trim().toLowerCase();
	if (normalized.includes('done') || normalized.includes('complete')) {
		return 'Complete';
	}
	if (normalized.includes('progress') || normalized.includes('active') || normalized.includes('doing') || normalized.includes('diagnostic')) {
		return 'In progress';
	}
	return 'To-do';
}

function showTableOptionPicker(anchor: HTMLElement, options: TablePickerOptions): void {
	document.querySelector('.db-table-picker-panel')?.remove();

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-record-picker-panel db-table-picker-panel';
	appendDatabaseOverlay(panel, anchor);

	const selectedRow = append(panel, $('div.db-record-picker-selected'));
	const list = append(panel, $('div.db-record-picker-list'));

	const selected = new Set(options.selected);

	const renderSelected = () => {
		clearNode(selectedRow);
		if (!selected.size) {
			selectedRow.style.display = 'none';
			return;
		}
		selectedRow.style.display = '';
		const optionById = new Map(options.options.map(option => [option.id, option]));
		for (const id of selected) {
			const option = optionById.get(id);
			if (!option) {
				continue;
			}
			const chip = append(selectedRow, $('button.db-record-picker-selected-chip')) as HTMLButtonElement;
			chip.type = 'button';
			const chipLabel = append(chip, $('span.db-record-picker-selected-chip-label'));
			chipLabel.textContent = option.label;
			if (option.color) {
				chipLabel.style.backgroundColor = option.color;
				chipLabel.style.color = getReadableTextColor(option.color);
			}
			const remove = append(chip, $('span.db-record-picker-selected-chip-remove'));
			remove.textContent = '×';
			chip.addEventListener('click', event => {
				event.preventDefault();
				selected.delete(option.id);
				options.onChange([...selected]);
				renderSelected();
				renderList();
			});
		}
	};

	const renderList = () => {
		clearNode(list);
		const filtered = options.options;
		if (!filtered.length) {
			const empty = append(list, $('div.db-panel-empty'));
			empty.textContent = 'No matches';
			return;
		}

		const grouped = new Map<string, TablePickerOption[]>();
		if (options.groupStatus) {
			for (const option of filtered) {
				const section = getStatusSection(option.label);
				const group = grouped.get(section) ?? [];
				group.push(option);
				grouped.set(section, group);
			}
		} else {
			grouped.set('', filtered);
		}

		for (const [section, sectionOptions] of grouped) {
			if (section) {
				const heading = append(list, $('div.db-record-picker-section-title'));
				heading.textContent = section;
			}
			for (const option of sectionOptions) {
				const item = append(list, $('button.db-record-picker-item')) as HTMLButtonElement;
				item.type = 'button';
				const label = append(item, $('span.db-record-picker-label'));
				label.textContent = option.label;
				if (option.color) {
					label.style.backgroundColor = option.color;
					label.style.color = getReadableTextColor(option.color);
					label.classList.add('db-record-picker-label--color');
				}
				const mark = append(item, $('span.db-record-picker-mark'));
				mark.textContent = selected.has(option.id) ? '✓' : '';
				item.addEventListener('click', () => {
					if (options.multi) {
						if (selected.has(option.id)) {
							selected.delete(option.id);
						} else {
							selected.add(option.id);
						}
						options.onChange([...selected]);
						renderSelected();
						renderList();
					} else {
						options.onChange([option.id]);
						close();
					}
				});
			}
		}
	};

	if (options.multi || options.onClear) {
		const actions = append(panel, $('div.db-panel-add'));
		const clearBtn = append(actions, $('button.db-btn')) as HTMLButtonElement;
		clearBtn.textContent = 'Clear';
		clearBtn.addEventListener('click', () => {
			selected.clear();
			if (options.onClear) {
				options.onClear();
			} else {
				options.onChange([]);
			}
			renderSelected();
			renderList();
		});
		if (options.multi) {
			const doneBtn = append(actions, $('button.db-btn.db-btn-primary')) as HTMLButtonElement;
			doneBtn.textContent = 'Done';
			doneBtn.addEventListener('click', close);
		}
	}

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;
	renderSelected();
	renderList();

	setTimeout(() => {
		const handler = (event: MouseEvent) => {
			if (!panel.contains(event.target as Node) && event.target !== anchor) {
				close();
				document.removeEventListener('mousedown', handler);
			}
		};
		document.addEventListener('mousedown', handler);
	}, 0);

	function close(): void {
		panel.remove();
	}
}

// ─── Main Render ─────────────────────────────────────────────────────────────

export function renderTable(
	container: HTMLElement,
	db: Database,
	viewId: string,
	opts: TableViewOptions,
): void {
	clearNode(container);

	const view = db.views.find(v => v.id === viewId);
	if (!view) { return; }

	const wrapper = append(container, $('div.db-table-wrapper'));
	const table = append(wrapper, $('table.db-table')) as HTMLTableElement;

	const visibleFields = getVisibleFields(db.schema, view);

	// ─── Header ──────────────────────────────────────────────────────────────
	const thead = append(table, $('thead'));
	const headerRow = append(thead, $('tr'));

	// Checkbox col
	append(headerRow, $('th.db-th.db-th-check'));

	for (const field of visibleFields) {
		const th = append(headerRow, $('th.db-th')) as HTMLTableCellElement;
		if (view.columnWidths?.[field.id]) {
			th.style.width = `${view.columnWidths[field.id]}px`;
		}

		const thInner = append(th, $('div.db-th-inner'));
		const thLabel = append(thInner, $('span.db-th-label'));
		thLabel.textContent = field.name;
		thLabel.classList.add('db-th-label-action');
		thLabel.title = 'Edit property';
		thLabel.addEventListener('click', (event) => {
			event.stopPropagation();
			showPropertyMenu(thLabel, field, opts.onUpdateField);
		});

		// Column resize handle
		const resizeHandle = append(th, $('div.db-col-resize-handle'));
		let startX = 0;
		let startW = 0;
		resizeHandle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			startX = e.clientX;
			startW = th.offsetWidth;
			const onMove = (me: MouseEvent) => {
				th.style.width = `${Math.max(60, startW + me.clientX - startX)}px`;
			};
			const onUp = (me: MouseEvent) => {
				const newW = Math.max(60, startW + me.clientX - startX);
				opts.onColumnWidthChange(field.id, newW);
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
		});
	}

	// Add field column header
	const addFieldTh = append(headerRow, $('th.db-th.db-th-add-field'));
	const addFieldBtn = append(addFieldTh, $('button.db-add-field-btn'));
	addFieldBtn.textContent = '+';
	addFieldBtn.title = 'Add field';
	addFieldBtn.addEventListener('click', () => showAddFieldForm(addFieldBtn, opts));

	// ─── Body ─────────────────────────────────────────────────────────────────
	const tbody = append(table, $('tbody'));

	let records = applyFilters(db.records, view.filter, db.schema, db, opts.resolveDatabase);
	records = applySorts(records, view.sort, db.schema, db, opts.resolveDatabase);

	if (view.groupBy) {
		renderGroupedRows(tbody, records, db, view, visibleFields, opts);
	} else {
		for (const record of records) {
			renderTableRow(tbody, record, db, visibleFields, opts);
		}
	}

	// Add record row
	const addRow = append(tbody, $('tr.db-add-row'));
	const addTd = append(addRow, $('td')) as HTMLTableCellElement;
	addTd.colSpan = visibleFields.length + 3;
	const addBtn = append(addTd, $('button.db-add-record-btn'));
	addBtn.textContent = '+ New record';
	addBtn.addEventListener('click', () => opts.onAddRecord());
}

function renderGroupedRows(
	tbody: HTMLElement,
	records: DBRecord[],
	db: Database,
	view: DBView,
	visibleFields: Field[],
	opts: TableViewOptions,
): void {
	const groupField = db.schema.find(f => f.id === view.groupBy);
	if (!groupField) {
		for (const r of records) { renderTableRow(tbody, r, db, visibleFields, opts); }
		return;
	}

	const groups = new Map<string, DBRecord[]>();
	const options: string[] = groupField.options ?? STATUS_OPTIONS;
	for (const opt of options) { groups.set(opt, []); }
	groups.set('', []);

	for (const record of records) {
		const val = record[view.groupBy!];
		const key = val != null && val !== '' ? String(val) : '';
		if (!groups.has(key)) { groups.set(key, []); }
		groups.get(key)!.push(record);
	}

	for (const [groupVal, groupRecords] of groups) {
		if (groupRecords.length === 0) { continue; }
		const groupRow = append(tbody, $('tr.db-group-header-row'));
		const groupTd = append(groupRow, $('td.db-group-header-cell')) as HTMLTableCellElement;
		groupTd.colSpan = visibleFields.length + 3;

		if (groupField.type === 'status' && groupVal) {
			const dot = append(groupTd, $('span.db-group-status-dot'));
			dot.style.backgroundColor = getStatusColor(groupVal);
		}
		const groupLabel = append(groupTd, $('span.db-group-label'));
		groupLabel.textContent = groupVal || 'No value';
		const groupCount = append(groupTd, $('span.db-group-count'));
		groupCount.textContent = String(groupRecords.length);

		for (const record of groupRecords) {
			renderTableRow(tbody, record, db, visibleFields, opts);
		}
	}
}

function renderTableRow(
	tbody: HTMLElement,
	record: DBRecord,
	db: Database,
	visibleFields: Field[],
	opts: TableViewOptions,
): void {
	const tr = append(tbody, $('tr.db-row'));

	// Checkbox
	const checkTd = append(tr, $('td.db-td.db-td-check'));
	const cb = append(checkTd, $('input')) as HTMLInputElement;
	cb.type = 'checkbox';
	cb.className = 'db-row-check';
	cb.addEventListener('click', e => e.stopPropagation());

	// Data cells
	const cellEls: HTMLTableCellElement[] = [];
	for (let i = 0; i < visibleFields.length; i++) {
		const field = visibleFields[i];
		const td = append(tr, $('td.db-td')) as HTMLTableCellElement;
		cellEls.push(td);
		td.tabIndex = 0;

		renderCellValue(td, record, field, db, opts.resolveDatabase);

		td.addEventListener('click', (e) => {
			e.stopPropagation();
			if (td.querySelector('.db-cell-editor, .db-multiselect-editor')) { return; }
			openCellEditor(td, record, field, db, opts.resolveDatabase, (value) => {
				record[field.id] = value;
				opts.onCellEdit(record.id, field.id, value);
				renderCellValue(td, record, field, db, opts.resolveDatabase);
			});
		});

		td.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); td.click(); }
			else if (e.key === 'Tab') {
				e.preventDefault();
				(e.shiftKey ? cellEls[i - 1] : cellEls[i + 1])?.focus();
			} else if (e.key === 'ArrowRight') { cellEls[i + 1]?.focus(); }
			else if (e.key === 'ArrowLeft') { cellEls[i - 1]?.focus(); }
		});
	}

	// Spacer
	append(tr, $('td.db-td.db-td-end'));

	// Row hover actions
	const actionsTd = append(tr, $('td.db-td.db-row-actions-cell'));
	const actionsEl = append(actionsTd, $('div.db-row-actions'));

	const openBtn = append(actionsEl, $('button.db-icon-btn'));
	openBtn.textContent = '↗';
	openBtn.title = 'Open record';
	openBtn.addEventListener('click', (e) => { e.stopPropagation(); opts.onRecordClick(record); });

	const dupBtn = append(actionsEl, $('button.db-icon-btn'));
	dupBtn.textContent = '⧉';
	dupBtn.title = 'Duplicate';
	dupBtn.addEventListener('click', (e) => { e.stopPropagation(); opts.onDuplicateRecord(record); });

	const delBtn = append(actionsEl, $('button.db-icon-btn.db-icon-btn-danger'));
	delBtn.textContent = '🗑';
	delBtn.title = 'Delete';
	delBtn.addEventListener('click', (e) => { e.stopPropagation(); opts.onDeleteRecord(record); });

	tr.addEventListener('click', () => opts.onRecordClick(record));
}

// ─── Add Field Form ───────────────────────────────────────────────────────────

const FIELD_TYPES: Field['type'][] = ['text', 'number', 'select', 'multiselect', 'relation', 'rollup', 'formula', 'date', 'checkbox', 'url', 'email', 'phone', 'status'];
const OPTION_COLOR_PRESETS: Array<{ label: string; value: string; swatch: string }> = [
	{ label: 'Gray', value: '#6b7280', swatch: '⚫' },
	{ label: 'Brown', value: '#8b6b4a', swatch: '🟤' },
	{ label: 'Amber', value: '#f59e0b', swatch: '🟡' },
	{ label: 'Green', value: '#10b981', swatch: '🟢' },
	{ label: 'Blue', value: '#3b82f6', swatch: '🔵' },
	{ label: 'Purple', value: '#a855f7', swatch: '🟣' },
	{ label: 'Red', value: '#ef4444', swatch: '🔴' },
];

function fieldTypeSupportsOptions(type: Field['type']): boolean {
	return type === 'select' || type === 'multiselect' || type === 'status';
}

function normalizeFieldForType(field: Field, nextType: Field['type']): Field {
	const nextField: Field = {
		id: field.id,
		name: field.name,
		type: nextType,
	};

	if (fieldTypeSupportsOptions(nextType)) {
		nextField.options = field.options?.length ? [...field.options] : (nextType === 'status' ? [...STATUS_OPTIONS] : []);
		if (field.optionColors) {
			nextField.optionColors = { ...field.optionColors };
		}
	}

	if (nextType === 'relation') {
		nextField.relation = field.relation ? { ...field.relation } : {};
	}

	if (nextType === 'rollup') {
		nextField.rollup = field.rollup ? { ...field.rollup } : { relationFieldId: '', aggregation: 'count' };
	}

	if (nextType === 'formula') {
		nextField.formula = field.formula ? { ...field.formula } : { expression: '' };
	}

	return nextField;
}

function showPropertyMenu(anchor: HTMLElement, field: Field, onSave: (field: Field) => void): void {
	document.querySelector('.db-property-menu-panel')?.remove();

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-property-menu-panel';
	appendDatabaseOverlay(panel, anchor);

	const nameRow = append(panel, $('div.db-property-menu-name-row'));
	const nameInput = append(nameRow, $('input.db-input.db-property-menu-name-input')) as HTMLInputElement;
	nameInput.value = field.name;
	nameInput.placeholder = 'Property name';

	const typeRow = append(panel, $('div.db-property-menu-type-row'));
	const typeLabel = append(typeRow, $('span.db-property-menu-type-label'));
	typeLabel.textContent = 'Type';
	const typeSelect = append(typeRow, $('select.db-select.db-property-menu-type-select')) as HTMLSelectElement;
	for (const type of FIELD_TYPES) {
		const option = append(typeSelect, $('option', { value: type })) as HTMLOptionElement;
		option.textContent = type;
		if (field.type === type) {
			option.selected = true;
		}
	}

	type OptionDraft = { name: string; color: string };
	const createOptionDrafts = (fromField: Field): OptionDraft[] => {
		const baseOptions = fromField.options ?? (fromField.type === 'status' ? STATUS_OPTIONS : []);
		return baseOptions.map((name, index) => ({
			name,
			color: fromField.optionColors?.[name] ?? OPTION_COLOR_PRESETS[index % OPTION_COLOR_PRESETS.length].value,
		}));
	};

	let drafts = createOptionDrafts(field);
	const optionsWrap = append(panel, $('div.db-property-menu-options-wrap'));
	const optionsTitle = append(optionsWrap, $('div.db-panel-section-title'));
	optionsTitle.textContent = 'Options';
	const optionsList = append(optionsWrap, $('div.db-property-option-list'));
	const optionsActions = append(optionsWrap, $('div.db-panel-add'));
	const addOptionBtn = append(optionsActions, $('button.db-btn')) as HTMLButtonElement;
	addOptionBtn.textContent = '+ Add option';

	let saveTimer: number | undefined;
	const commit = () => onSave(draftField());
	const scheduleSave = (immediate = false) => {
		if (saveTimer !== undefined) {
			window.clearTimeout(saveTimer);
			saveTimer = undefined;
		}
		if (immediate) {
			commit();
			return;
		}
		saveTimer = window.setTimeout(() => {
			saveTimer = undefined;
			commit();
		}, 160);
	};

	const close = () => {
		if (saveTimer !== undefined) {
			window.clearTimeout(saveTimer);
			saveTimer = undefined;
			commit();
		}
		panel.remove();
	};

	const renderOptions = () => {
		clearNode(optionsList);
		for (const draft of drafts) {
			const row = append(optionsList, $('div.db-property-option-row'));
			const nameField = append(row, $('input.db-input.db-property-option-name')) as HTMLInputElement;
			nameField.value = draft.name;
			nameField.placeholder = 'Option name';
			nameField.addEventListener('input', () => {
				draft.name = nameField.value;
				scheduleSave();
			});

			const colorBtn = append(row, $('button.db-btn.db-property-color-btn')) as HTMLButtonElement;
			const updateColorLabel = () => {
				const preset = OPTION_COLOR_PRESETS.find(color => color.value.toLowerCase() === draft.color.toLowerCase()) ?? OPTION_COLOR_PRESETS[0];
				colorBtn.textContent = preset.label;
				colorBtn.style.backgroundColor = preset.value;
				colorBtn.style.color = getReadableTextColor(preset.value);
			};
			updateColorLabel();
			colorBtn.addEventListener('click', event => {
				event.stopPropagation();
				showPropertyColorMenu(panel, colorBtn, draft.color, nextColor => {
					draft.color = nextColor;
					updateColorLabel();
					scheduleSave(true);
				});
			});

			const removeBtn = append(row, $('button.db-icon-btn'));
			removeBtn.textContent = '✕';
			removeBtn.title = 'Remove option';
			removeBtn.addEventListener('click', () => {
				const index = drafts.indexOf(draft);
				if (index >= 0) {
					drafts.splice(index, 1);
					renderOptions();
					scheduleSave(true);
				}
			});
		}
	};

	const syncOptionsVisibility = () => {
		const supports = fieldTypeSupportsOptions(typeSelect.value as Field['type']);
		optionsWrap.style.display = supports ? '' : 'none';
	};

	addOptionBtn.addEventListener('click', () => {
		drafts.push({ name: '', color: OPTION_COLOR_PRESETS[drafts.length % OPTION_COLOR_PRESETS.length].value });
		renderOptions();
		const optionNameInputs = optionsList.querySelectorAll<HTMLInputElement>('.db-property-option-name');
		optionNameInputs[optionNameInputs.length - 1]?.focus();
		scheduleSave(true);
	});

	const draftField = (): Field => {
		const nextType = typeSelect.value as Field['type'];
		const nextName = nameInput.value.trim() || field.name;
		const nextField = normalizeFieldForType({ ...field, name: nextName }, nextType);
		if (fieldTypeSupportsOptions(nextType)) {
			const options: string[] = [];
			const optionColors: Record<string, string> = {};
			for (const draft of drafts) {
				const name = draft.name.trim();
				if (!name || options.includes(name)) {
					continue;
				}
				options.push(name);
				optionColors[name] = draft.color;
			}
			nextField.options = options.length ? options : (nextType === 'status' ? [...STATUS_OPTIONS] : []);
			nextField.optionColors = optionColors;
		}
		return nextField;
	};

	typeSelect.addEventListener('change', () => {
		const nextType = typeSelect.value as Field['type'];
		if (fieldTypeSupportsOptions(nextType) && drafts.length === 0) {
			const temporaryField = normalizeFieldForType(field, nextType);
			drafts = createOptionDrafts(temporaryField);
		}
		syncOptionsVisibility();
		renderOptions();
		scheduleSave(true);
	});
	nameInput.addEventListener('input', () => {
		scheduleSave();
	});

	nameInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			close();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	});

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;

	nameInput.focus();
	nameInput.select();
	syncOptionsVisibility();
	renderOptions();

	setTimeout(() => {
		const handler = (event: MouseEvent) => {
			if (!panel.contains(event.target as Node) && event.target !== anchor) {
				close();
				document.removeEventListener('mousedown', handler);
			}
		};
		document.addEventListener('mousedown', handler);
	}, 0);
}

function showAddFieldForm(anchor: HTMLElement, opts: TableViewOptions): void {
	const existing = document.querySelector('.db-add-field-form');
	if (existing) { existing.remove(); return; }

	const form = document.createElement('div');
	form.className = 'db-add-field-form db-dropdown-panel';
	appendDatabaseOverlay(form, anchor);

	const nameInput = append(form, $('input.db-input')) as HTMLInputElement;
	nameInput.placeholder = 'Field name';

	const typeSelect = append(form, $('select.db-select')) as HTMLSelectElement;
	for (const t of FIELD_TYPES) {
		const o = append(typeSelect, $('option', { value: t })) as HTMLOptionElement;
		o.textContent = t;
	}

	const addBtn = append(form, $('button.db-btn.db-btn-primary'));
	addBtn.textContent = 'Add';

	// Position below anchor
	const rect = anchor.getBoundingClientRect();
	form.style.top = `${rect.bottom + 4}px`;
	form.style.left = `${rect.left}px`;

	const cancel = () => form.remove();
	const submit = () => {
		const name = nameInput.value.trim();
		if (!name) { nameInput.focus(); return; }
		opts.onAddField(name, typeSelect.value as Field['type']);
		cancel();
	};

	addBtn.addEventListener('click', submit);
	nameInput.addEventListener('keydown', e => {
		if (e.key === 'Enter') { submit(); }
		if (e.key === 'Escape') { cancel(); }
	});
	nameInput.focus();

	setTimeout(() => {
		const handler = (e: MouseEvent) => {
			if (!form.contains(e.target as Node) && e.target !== anchor) {
				cancel();
				document.removeEventListener('mousedown', handler);
			}
		};
		document.addEventListener('mousedown', handler);
	}, 0);
}

function showPropertyColorMenu(
	hostPanel: HTMLElement,
	anchor: HTMLElement,
	currentColor: string,
	onPick: (nextColor: string) => void,
): void {
	hostPanel.querySelector('.db-property-color-menu')?.remove();

	const menu = document.createElement('div');
	menu.className = 'db-context-menu db-property-color-menu';
	hostPanel.appendChild(menu);

	for (const color of OPTION_COLOR_PRESETS) {
		const item = append(menu, $('div.db-context-menu-item.db-property-color-item'));
		const pill = append(item, $('span.db-property-color-pill'));
		pill.textContent = color.label;
		pill.style.backgroundColor = color.value;
		pill.style.color = getReadableTextColor(color.value);
		if (color.value.toLowerCase() === currentColor.toLowerCase()) {
			item.classList.add('db-property-color-item--active');
		}
		item.addEventListener('click', () => {
			onPick(color.value);
			menu.remove();
		});
	}

	const rect = anchor.getBoundingClientRect();
	menu.style.top = `${rect.bottom + 4}px`;
	menu.style.left = `${rect.left}px`;

	setTimeout(() => {
		const close = (event: MouseEvent) => {
			if (!menu.contains(event.target as Node) && event.target !== anchor) {
				menu.remove();
				document.removeEventListener('mousedown', close);
			}
		};
		document.addEventListener('mousedown', close);
	}, 0);
}

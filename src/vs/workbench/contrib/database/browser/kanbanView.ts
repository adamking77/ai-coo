/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DatabaseResolver, DBRecord, getRecordTitle, applySorts, applyFilters, getStatusColor, STATUS_OPTIONS, getFieldValue, getRelationTargetDatabase, getFieldOptionColor, getReadableTextColor } from '../common/database.js';

export interface KanbanViewOptions {
	onRecordClick: (record: DBRecord) => void;
	onRecordMove: (recordId: string, fieldId: string, newValue: string) => void;
	onAddRecord: (groupValue: string) => void;
	onDuplicateRecord: (record: DBRecord) => void;
	onDeleteRecord: (record: DBRecord) => void;
	resolveDatabase?: DatabaseResolver;
}

export function renderKanban(
	container: HTMLElement,
	db: Database,
	viewId: string,
	opts: KanbanViewOptions,
): void {
	clearNode(container);

	const view = db.views.find(v => v.id === viewId);
	if (!view || view.type !== 'kanban') { return; }

	const groupField = db.schema.find(f => f.id === view.groupBy);
	if (!groupField) {
		const msg = append(container, $('div.db-kanban-empty'));
		msg.textContent = 'No group-by field configured. Edit this view to set one.';
		return;
	}

	let records = applyFilters(db.records, view.filter, db.schema, db, opts.resolveDatabase);
	records = applySorts(records, view.sort, db.schema, db, opts.resolveDatabase);

	const options: string[] = groupField.options ?? STATUS_OPTIONS;
	const allGroups = [...options, ''];

	const grouped = new Map<string, DBRecord[]>();
	for (const g of allGroups) { grouped.set(g, []); }
	for (const record of records) {
		const val = String(record[groupField.id] ?? '');
		if (grouped.has(val)) { grouped.get(val)!.push(record); }
		else { grouped.get('')!.push(record); }
	}

	// Track collapsed state per column
	const collapsedCols = new Set<string>();

	const board = append(container, $('div.db-kanban-board'));

	for (const group of allGroups) {
		const colRecords = grouped.get(group) ?? [];
		if (colRecords.length === 0 && group === '') { continue; } // skip empty "no value" col

		const col = append(board, $('div.db-kanban-col'));

		// Drag-over feedback
		col.addEventListener('dragover', e => {
			e.preventDefault();
			col.classList.add('db-kanban-col--over');
		});
		col.addEventListener('dragleave', () => col.classList.remove('db-kanban-col--over'));
		col.addEventListener('drop', e => {
			e.preventDefault();
			col.classList.remove('db-kanban-col--over');
			const recordId = e.dataTransfer?.getData('text/plain');
			if (recordId) { opts.onRecordMove(recordId, groupField.id, group); }
		});

		// Column header
		const header = append(col, $('div.db-kanban-col-header'));

		// Status color dot
		if (groupField.type === 'status' && group) {
			const dot = append(header, $('span.db-kanban-col-dot'));
			dot.style.backgroundColor = getStatusColor(group);
		}

		const titleEl = append(header, $('span.db-kanban-col-title'));
		titleEl.textContent = group || 'No value';

		// Collapse toggle
		const collapseBtn = append(header, $('button.db-icon-btn.db-kanban-collapse-btn'));
		collapseBtn.title = 'Collapse column';
		collapseBtn.textContent = '−';
		collapseBtn.addEventListener('click', () => {
			if (collapsedCols.has(group)) {
				collapsedCols.delete(group);
				collapseBtn.textContent = '−';
				cardList.style.display = '';
				addBtn.style.display = '';
			} else {
				collapsedCols.add(group);
				collapseBtn.textContent = '+';
				cardList.style.display = 'none';
				addBtn.style.display = 'none';
			}
		});

		// Cards
		const cardList = append(col, $('div.db-kanban-cards'));
		for (const record of colRecords) {
			renderCard(cardList, record, db, view.cardFields, opts);
		}

		// Add card
		const addBtn = append(col, $('button.db-kanban-add'));
		addBtn.textContent = '+ Add';
		addBtn.addEventListener('click', () => opts.onAddRecord(group));
	}
}

function renderCard(
	container: HTMLElement,
	record: DBRecord,
	db: Database,
	cardFields: string[] | undefined,
	opts: KanbanViewOptions,
): void {
	const card = append(container, $('div.db-kanban-card'));
	card.draggable = true;

	card.addEventListener('dragstart', e => {
		e.dataTransfer?.setData('text/plain', record.id);
		e.dataTransfer!.effectAllowed = 'move';
		card.classList.add('db-kanban-card--dragging');
	});
	card.addEventListener('dragend', () => card.classList.remove('db-kanban-card--dragging'));

	// Status accent bar
	const statusField = db.schema.find(f => f.type === 'status');
	if (statusField) {
		const val = record[statusField.id];
		if (val) {
			const accent = append(card, $('div.db-kanban-card-accent'));
			accent.style.backgroundColor = getStatusColor(String(val));
		}
	}

	// Title
	const title = append(card, $('div.db-kanban-card-title'));
	title.textContent = getRecordTitle(record, db.schema);

	// Fields to show on card
	const fieldsToShow = cardFields
		? db.schema.filter(f => cardFields.includes(f.id))
		: db.schema.filter(f => f.type !== 'text').slice(0, 3);

	for (const field of fieldsToShow) {
		const val = getFieldValue(record, field, db, opts.resolveDatabase);
		if (val == null || val === '') { continue; }

		const row = append(card, $('div.db-kanban-card-field'));

		if (field.type === 'status' && val) {
			const badge = append(row, $('span.db-status-badge'));
			badge.textContent = String(val);
			badge.style.backgroundColor = getStatusColor(String(val));
		} else if (field.type === 'relation' && Array.isArray(val)) {
			const targetDb = getRelationTargetDatabase(db, field, opts.resolveDatabase);
			for (const linkedId of val) {
				const linked = targetDb.records.find(candidate => candidate.id === linkedId);
				const badge = append(row, $('span.db-select-badge'));
				badge.textContent = linked ? getRecordTitle(linked, targetDb.schema) : String(linkedId);
			}
		} else if (field.type === 'select' || field.type === 'multiselect') {
			const vals = Array.isArray(val) ? val : [String(val)];
			for (const v of vals) {
				const badge = append(row, $('span.db-select-badge'));
				badge.textContent = v;
				const bg = getFieldOptionColor(field, v);
				badge.style.backgroundColor = bg;
				badge.style.color = getReadableTextColor(bg);
			}
		} else if (field.type === 'checkbox') {
			row.textContent = `${field.name}: ${val ? '✓' : '—'}`;
		} else {
			row.textContent = `${field.name}: ${String(val)}`;
		}
	}

	// Card actions (shown on hover via CSS)
	const actions = append(card, $('div.db-kanban-card-actions'));
	const dupBtn = append(actions, $('button.db-icon-btn'));
	dupBtn.textContent = '⧉';
	dupBtn.title = 'Duplicate';
	dupBtn.addEventListener('click', e => { e.stopPropagation(); opts.onDuplicateRecord(record); });

	const delBtn = append(actions, $('button.db-icon-btn.db-icon-btn-danger'));
	delBtn.textContent = '🗑';
	delBtn.title = 'Delete';
	delBtn.addEventListener('click', e => { e.stopPropagation(); opts.onDeleteRecord(record); });

	card.addEventListener('click', () => opts.onRecordClick(record));
}

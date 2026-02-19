/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DatabaseResolver, DBRecord, getRecordTitle, getVisibleFields, applySorts, applyFilters, getStatusColor, getFieldValue, getRelationTargetDatabase } from '../common/database.js';

export interface ListViewOptions {
	onRecordClick: (record: DBRecord) => void;
	onAddRecord: () => void;
	resolveDatabase?: DatabaseResolver;
}

export function renderList(
	container: HTMLElement,
	db: Database,
	viewId: string,
	opts: ListViewOptions,
): void {
	clearNode(container);

	const view = db.views.find(v => v.id === viewId);
	if (!view) { return; }

	const wrapper = append(container, $('div.db-list-view-wrapper'));

	let records = applyFilters(db.records, view.filter, db.schema, db, opts.resolveDatabase);
	records = applySorts(records, view.sort, db.schema, db, opts.resolveDatabase);

	const visibleFields = getVisibleFields(db.schema, view);
	// Show up to 4 non-title fields as metadata
	const titleField = db.schema.find(f => f.type === 'text');
	const metaFields = visibleFields.filter(f => f !== titleField).slice(0, 4);

	for (const record of records) {
		const row = append(wrapper, $('div.db-list-row'));
		row.addEventListener('click', () => opts.onRecordClick(record));

		// Status dot (if there's a status field)
		const statusField = db.schema.find(f => f.type === 'status');
		if (statusField) {
			const dot = append(row, $('span.db-list-status-dot'));
			const val = record[statusField.id];
			dot.style.backgroundColor = val ? getStatusColor(String(val)) : 'var(--vscode-descriptionForeground)';
		}

		// Title
		const title = append(row, $('span.db-list-row-title'));
		title.textContent = getRecordTitle(record, db.schema);

		// Meta fields
		const meta = append(row, $('span.db-list-row-meta'));
		const metaParts: string[] = [];
		for (const field of metaFields) {
			const val = getFieldValue(record, field, db, opts.resolveDatabase);
			if (val == null || val === '') { continue; }
			if (Array.isArray(val)) {
				if (field.type === 'relation') {
					const targetDb = getRelationTargetDatabase(db, field, opts.resolveDatabase);
					const titles = val.map(id => {
						const linked = targetDb.records.find(candidate => candidate.id === id);
						return linked ? getRecordTitle(linked, targetDb.schema) : String(id);
					});
					metaParts.push(titles.join(', '));
				} else {
					metaParts.push(val.join(', '));
				}
			} else if (typeof val === 'boolean') {
				metaParts.push(`${field.name}: ${val ? '✓' : '—'}`);
			} else {
				metaParts.push(String(val));
			}
		}
		meta.textContent = metaParts.join('  ·  ');

		// Hover actions
		const actions = append(row, $('div.db-list-row-actions'));
		const openBtn = append(actions, $('button.db-icon-btn'));
		openBtn.textContent = '↗';
		openBtn.title = 'Open record';
		openBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			opts.onRecordClick(record);
		});
	}

	if (records.length === 0) {
		const empty = append(wrapper, $('div.db-empty-state'));
		empty.textContent = 'No records. Add one below.';
	}

	// Add record
	const addRow = append(wrapper, $('div.db-list-add-row'));
	addRow.addEventListener('click', () => opts.onAddRecord());
	const addIcon = append(addRow, $('span'));
	addIcon.textContent = '+ New record';
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DatabaseResolver, DBRecord, getRecordTitle, getVisibleFields, applySorts, applyFilters, getStatusColor, STATUS_OPTIONS, getFieldValue, getRelationTargetDatabase, getFieldOptionColor, getReadableTextColor } from '../common/database.js';

export interface GalleryViewOptions {
	onRecordClick: (record: DBRecord) => void;
	onAddRecord: () => void;
	resolveDatabase?: DatabaseResolver;
}

/** Returns a background color for the card cover based on record content */
function getCardCoverColor(record: DBRecord, db: Database): string {
	// Use status field color if present
	const statusField = db.schema.find(f => f.type === 'status');
	if (statusField) {
		const val = record[statusField.id];
		if (val) { return getStatusColor(String(val)); }
	}
	// Use first select field color (index-based)
	const selectField = db.schema.find(f => f.type === 'select' && f.options?.length);
	if (selectField) {
		const val = record[selectField.id];
		if (val && selectField.options) {
			const idx = selectField.options.indexOf(String(val));
			const colors = ['var(--vscode-charts-blue)', 'var(--vscode-charts-orange)', 'var(--vscode-charts-green)', 'var(--vscode-charts-purple)', 'var(--vscode-charts-yellow)'];
			if (idx >= 0) { return colors[idx % colors.length]; }
		}
	}
	return 'var(--vscode-editorWidget-background)';
}

function getCardCoverEmoji(record: DBRecord, db: Database): string {
	const statusField = db.schema.find(f => f.type === 'status');
	if (statusField) {
		const val = String(record[statusField.id] ?? '');
		if (val === STATUS_OPTIONS[2]) { return '✓'; }
		if (val === STATUS_OPTIONS[1]) { return '⏳'; }
	}
	return '📄';
}

export function renderGallery(
	container: HTMLElement,
	db: Database,
	viewId: string,
	opts: GalleryViewOptions,
): void {
	clearNode(container);

	const view = db.views.find(v => v.id === viewId);
	if (!view) { return; }

	const grid = append(container, $('div.db-gallery-grid'));

	let records = applyFilters(db.records, view.filter, db.schema, db, opts.resolveDatabase);
	records = applySorts(records, view.sort, db.schema, db, opts.resolveDatabase);

	const visibleFields = getVisibleFields(db.schema, view);
	const titleField = db.schema.find(f => f.type === 'text');
	const propFields = visibleFields.filter(f => f !== titleField && f.type !== 'status').slice(0, 4);

	for (const record of records) {
		const card = append(grid, $('div.db-gallery-card'));
		card.addEventListener('click', () => opts.onRecordClick(record));

		// Cover
		const cover = append(card, $('div.db-gallery-cover'));
		cover.style.backgroundColor = getCardCoverColor(record, db);
		const emoji = append(cover, $('span.db-gallery-cover-emoji'));
		emoji.textContent = getCardCoverEmoji(record, db);

		// Body
		const body = append(card, $('div.db-gallery-body'));

		// Title
		const title = append(body, $('div.db-gallery-card-title'));
		title.textContent = getRecordTitle(record, db.schema);

		// Properties
		for (const field of propFields) {
			const val = getFieldValue(record, field, db, opts.resolveDatabase);
			if (val == null || val === '') { continue; }

			const prop = append(body, $('div.db-gallery-card-prop'));
			const propLabel = append(prop, $('span.db-gallery-prop-label'));
			propLabel.textContent = field.name;

			const propVal = append(prop, $('span.db-gallery-prop-value'));
			if (Array.isArray(val)) {
				const values = field.type === 'relation'
					? val.map(id => {
						const targetDb = getRelationTargetDatabase(db, field, opts.resolveDatabase);
						const linked = targetDb.records.find(candidate => candidate.id === id);
						return linked ? getRecordTitle(linked, targetDb.schema) : String(id);
					})
					: val;
				for (const v of values) {
					const badge = append(propVal, $('span.db-select-badge'));
					badge.textContent = v;
					if (field.type === 'select' || field.type === 'multiselect') {
						const bg = getFieldOptionColor(field, v);
						badge.style.backgroundColor = bg;
						badge.style.color = getReadableTextColor(bg);
					}
				}
			} else if (typeof val === 'boolean') {
				propVal.textContent = val ? '✓' : '—';
			} else {
				propVal.textContent = String(val);
			}
		}
	}

	// Add card
	const addCard = append(grid, $('div.db-gallery-add-card'));
	addCard.addEventListener('click', () => opts.onAddRecord());
	addCard.textContent = '+ New record';
}

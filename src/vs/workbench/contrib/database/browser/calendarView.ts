/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DBRecord, applyFilters, applySorts, getRecordTitle } from '../common/database.js';

export interface CalendarViewOptions {
	onRecordClick: (record: DBRecord) => void;
	onAddRecord: (dateValue?: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function renderCalendar(
	container: HTMLElement,
	db: Database,
	viewId: string,
	opts: CalendarViewOptions,
): void {
	clearNode(container);

	const view = db.views.find(v => v.id === viewId);
	if (!view || view.type !== 'calendar') { return; }

	let records = applyFilters(db.records, view.filter, db.schema, db);
	records = applySorts(records, view.sort, db.schema, db);

	const dateField = db.schema.find(field => field.id === view.groupBy && field.type === 'date')
		?? db.schema.find(field => field.type === 'date');
	if (!dateField) {
		const empty = append(container, $('div.db-empty-state'));
		empty.textContent = 'Calendar view needs at least one date field.';
		return;
	}

	let monthCursor = new Date();
	monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);

	const root = append(container, $('div.db-calendar-root'));
	const header = append(root, $('div.db-calendar-header'));
	const prevBtn = append(header, $('button.db-btn'));
	prevBtn.textContent = '<';
	const monthLabel = append(header, $('div.db-calendar-title'));
	const nextBtn = append(header, $('button.db-btn'));
	nextBtn.textContent = '>';
	const addBtn = append(header, $('button.db-btn.db-btn-primary'));
	addBtn.textContent = '+ Record';
	addBtn.addEventListener('click', () => opts.onAddRecord());

	const grid = append(root, $('div.db-calendar-grid'));
	for (const day of WEEKDAY_LABELS) {
		const label = append(grid, $('div.db-calendar-weekday'));
		label.textContent = day;
	}

	const renderMonth = () => {
		while (grid.children.length > 7) {
			grid.lastChild?.remove();
		}

		monthLabel.textContent = monthCursor.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

		const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
		const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
		const offset = start.getDay();
		const daysInMonth = end.getDate();
		const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

		for (let index = 0; index < cells; index++) {
			const dayNum = index - offset + 1;
			const cell = append(grid, $('div.db-calendar-cell'));
			if (dayNum < 1 || dayNum > daysInMonth) {
				cell.classList.add('db-calendar-cell--muted');
				continue;
			}

			const cellDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNum);
			const isoDate = cellDate.toISOString().slice(0, 10);

			const dayLabel = append(cell, $('div.db-calendar-day'));
			dayLabel.textContent = String(dayNum);

			const dayRecords = records.filter(record => {
				const raw = record[dateField.id];
				if (!raw || typeof raw !== 'string') { return false; }
				return raw.slice(0, 10) === isoDate;
			});

			for (const record of dayRecords.slice(0, 4)) {
				const chip = append(cell, $('button.db-calendar-event'));
				chip.textContent = getRecordTitle(record, db.schema);
				chip.addEventListener('click', e => { e.stopPropagation(); opts.onRecordClick(record); });
			}

			if (dayRecords.length > 4) {
				const more = append(cell, $('div.db-calendar-more'));
				more.textContent = `+${dayRecords.length - 4} more`;
			}

			cell.addEventListener('dblclick', () => opts.onAddRecord(isoDate));
		}
	};

	prevBtn.addEventListener('click', () => {
		monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
		renderMonth();
	});
	nextBtn.addEventListener('click', () => {
		monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
		renderMonth();
	});

	renderMonth();
}

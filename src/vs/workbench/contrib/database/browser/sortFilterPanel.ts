/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Database, DBView, Field } from '../common/database.js';

type SortEntry = { id: string; fieldId: string; direction: 'asc' | 'desc' };
type FilterEntry = { id: string; fieldId: string; op: string; value: string };

const FILTER_OPS_TEXT = [
	{ op: 'contains', label: 'contains' },
	{ op: 'not_contains', label: 'does not contain' },
	{ op: 'equals', label: 'equals' },
	{ op: 'not_equals', label: 'does not equal' },
	{ op: 'is_empty', label: 'is empty' },
	{ op: 'is_not_empty', label: 'is not empty' },
];
const FILTER_OPS_NUMBER = [
	{ op: 'equals', label: '=' },
	{ op: 'not_equals', label: '≠' },
	{ op: 'gt', label: '>' },
	{ op: 'gte', label: '≥' },
	{ op: 'lt', label: '<' },
	{ op: 'lte', label: '≤' },
	{ op: 'is_empty', label: 'is empty' },
	{ op: 'is_not_empty', label: 'is not empty' },
];

function getOpsFor(field: Field | undefined): { op: string; label: string }[] {
	if (!field) { return FILTER_OPS_TEXT; }
	if (field.type === 'number') { return FILTER_OPS_NUMBER; }
	if (field.type === 'checkbox') {
		return [
			{ op: 'equals', label: 'is' },
			{ op: 'not_equals', label: 'is not' },
			{ op: 'is_empty', label: 'is empty' },
			{ op: 'is_not_empty', label: 'is not empty' },
		];
	}
	return FILTER_OPS_TEXT;
}

function defaultOpForField(field: Field | undefined): string {
	if (!field) { return 'contains'; }
	if (field.type === 'number') { return 'equals'; }
	if (field.type === 'checkbox') { return 'equals'; }
	return 'contains';
}

function needsValueInput(op: string): boolean {
	return op !== 'is_empty' && op !== 'is_not_empty';
}

/** Dropdown panel anchored below a trigger element */
function createDropdown(anchor: HTMLElement, content: HTMLElement): HTMLElement {
	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel';
	panel.appendChild(content);
	document.body.appendChild(panel);

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;

	const close = (e: MouseEvent) => {
		if (!panel.contains(e.target as Node) && e.target !== anchor) {
			panel.remove();
			document.removeEventListener('mousedown', close);
		}
	};
	setTimeout(() => document.addEventListener('mousedown', close), 0);
	return panel;
}

// ─── Sort Panel ───────────────────────────────────────────────────────────────

export function showSortPanel(
	anchor: HTMLElement,
	db: Database,
	view: DBView,
	onChange: () => void,
): void {
	const sorts: SortEntry[] = view.sort.map(s => ({ id: generateUuid(), ...s }));
	const schema = db.schema;

	const content = $('div.db-sort-panel-content');

	function render(): void {
		clearNode(content);
		if (sorts.length === 0) {
			const empty = append(content, $('div.db-panel-empty'));
			empty.textContent = 'No sorts applied';
		}
		for (const sort of sorts) {
			const row = append(content, $('div.db-panel-row'));

			// Field selector
			const fieldSel = append(row, $('select.db-select')) as HTMLSelectElement;
			for (const f of schema) {
				const o = append(fieldSel, $('option', { value: f.id })) as HTMLOptionElement;
				o.textContent = f.name;
				if (f.id === sort.fieldId) { o.selected = true; }
			}
			fieldSel.addEventListener('change', () => {
				sort.fieldId = fieldSel.value;
				flush();
			});

			// Direction toggle
			const dirBtn = append(row, $('button.db-btn')) as HTMLButtonElement;
			dirBtn.textContent = sort.direction === 'asc' ? '↑ Asc' : '↓ Desc';
			dirBtn.addEventListener('click', () => {
				sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
				flush();
				render();
			});

			// Remove
			const removeBtn = append(row, $('button.db-icon-btn'));
			removeBtn.textContent = '✕';
			removeBtn.title = 'Remove sort';
			removeBtn.setAttribute('aria-label', 'Remove sort');
			removeBtn.addEventListener('click', () => {
				const idx = sorts.indexOf(sort);
				if (idx >= 0) { sorts.splice(idx, 1); }
				flush();
				render();
			});
		}

		// Add sort
		const addRow = append(content, $('div.db-panel-add'));
		const addBtn = append(addRow, $('button.db-btn'));
		addBtn.textContent = '+ Add sort';
		addBtn.addEventListener('click', () => {
			const firstField = schema[0];
			if (!firstField) { return; }
			sorts.push({ id: generateUuid(), fieldId: firstField.id, direction: 'asc' });
			flush();
			render();
		});
		if (sorts.length > 0) {
			const clearBtn = append(addRow, $('button.db-btn'));
			clearBtn.textContent = 'Clear';
			clearBtn.addEventListener('click', () => {
				sorts.splice(0, sorts.length);
				flush();
				render();
			});
		}
	}

	function flush(): void {
		view.sort = sorts.map(s => ({ fieldId: s.fieldId, direction: s.direction }));
		onChange();
	}

	render();
	createDropdown(anchor, content);
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

export function showFilterPanel(
	anchor: HTMLElement,
	db: Database,
	view: DBView,
	onChange: () => void,
): void {
	const filters: FilterEntry[] = view.filter.map(f => ({ id: generateUuid(), ...f }));
	const schema = db.schema;

	const content = $('div.db-filter-panel-content');

	function render(): void {
		clearNode(content);
		if (filters.length === 0) {
			const empty = append(content, $('div.db-panel-empty'));
			empty.textContent = 'No filters applied';
		}
		for (const filter of filters) {
			const row = append(content, $('div.db-panel-row'));
			const field = schema.find(f => f.id === filter.fieldId);

			// Field selector
			const fieldSel = append(row, $('select.db-select')) as HTMLSelectElement;
			for (const f of schema) {
				const o = append(fieldSel, $('option', { value: f.id })) as HTMLOptionElement;
				o.textContent = f.name;
				if (f.id === filter.fieldId) { o.selected = true; }
			}
			fieldSel.addEventListener('change', () => {
				filter.fieldId = fieldSel.value;
				filter.op = defaultOpForField(schema.find(candidate => candidate.id === fieldSel.value));
				filter.value = '';
				flush();
				render();
			});

			// Operator selector
			const opSel = append(row, $('select.db-select')) as HTMLSelectElement;
			for (const op of getOpsFor(field)) {
				const o = append(opSel, $('option', { value: op.op })) as HTMLOptionElement;
				o.textContent = op.label;
				if (op.op === filter.op) { o.selected = true; }
			}
			opSel.addEventListener('change', () => {
				filter.op = opSel.value;
				flush();
				render();
			});

			// Value input (hidden for is_empty/is_not_empty)
			if (needsValueInput(filter.op)) {
				const valInput = append(row, $('input.db-input')) as HTMLInputElement;
				valInput.value = filter.value;
				valInput.placeholder = 'Value';
				valInput.style.width = '100px';
				valInput.addEventListener('input', () => {
					filter.value = valInput.value;
					flush();
				});
			}

			// Remove
			const removeBtn = append(row, $('button.db-icon-btn'));
			removeBtn.textContent = '✕';
			removeBtn.title = 'Remove filter';
			removeBtn.setAttribute('aria-label', 'Remove filter');
			removeBtn.addEventListener('click', () => {
				const idx = filters.indexOf(filter);
				if (idx >= 0) { filters.splice(idx, 1); }
				flush();
				render();
			});
		}

		// Add filter
		const addRow = append(content, $('div.db-panel-add'));
		const addBtn = append(addRow, $('button.db-btn'));
		addBtn.textContent = '+ Add filter';
		addBtn.addEventListener('click', () => {
			const firstField = schema[0];
			if (!firstField) { return; }
			filters.push({ id: generateUuid(), fieldId: firstField.id, op: defaultOpForField(firstField), value: '' });
			flush();
			render();
		});
		if (filters.length > 0) {
			const clearBtn = append(addRow, $('button.db-btn'));
			clearBtn.textContent = 'Clear';
			clearBtn.addEventListener('click', () => {
				filters.splice(0, filters.length);
				flush();
				render();
			});
		}
	}

	function flush(): void {
		view.filter = filters.map(f => ({ fieldId: f.fieldId, op: f.op, value: f.value }));
		onChange();
	}

	render();
	createDropdown(anchor, content);
}

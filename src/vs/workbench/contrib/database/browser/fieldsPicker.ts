/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DBView } from '../common/database.js';

/** Show/hide/reorder fields panel anchored below a trigger button */
export function showFieldsPicker(
	anchor: HTMLElement,
	db: Database,
	view: DBView,
	onChange: () => void,
	onManageFields?: () => void,
): void {
	const schema = db.schema;
	// Working copy of field order
	const order: string[] = view.fieldOrder?.length
		? [...view.fieldOrder]
		: schema.map(f => f.id);
	// Ensure all schema fields are in order (new fields added after last save)
	for (const f of schema) {
		if (!order.includes(f.id)) { order.push(f.id); }
	}
	const hidden = new Set<string>(view.hiddenFields ?? []);

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-fields-panel';

	const title = append(panel, $('div.db-panel-section-title'));
	title.textContent = 'Fields';

	const list = append(panel, $('div.db-fields-list'));

	let dragSrc: string | null = null;

	function render(): void {
		clearNode(list);
		for (const fieldId of order) {
			const field = schema.find(f => f.id === fieldId);
			if (!field) { continue; }

			const row = append(list, $('div.db-fields-row'));
			row.draggable = true;
			row.dataset['fieldId'] = fieldId;

			// Drag handle
			const handle = append(row, $('span.db-fields-handle'));
			handle.textContent = '⠿';

			// Toggle checkbox
			const cb = append(row, $('input')) as HTMLInputElement;
			cb.type = 'checkbox';
			cb.checked = !hidden.has(fieldId);
			cb.addEventListener('change', () => {
				if (cb.checked) { hidden.delete(fieldId); } else { hidden.add(fieldId); }
				flush();
			});

			// Field name
			const name = append(row, $('span.db-fields-name'));
			name.textContent = field.name;

			// Drag-and-drop reorder
			row.addEventListener('dragstart', (e) => {
				dragSrc = fieldId;
				e.dataTransfer!.effectAllowed = 'move';
				row.classList.add('db-fields-row--dragging');
			});
			row.addEventListener('dragend', () => {
				row.classList.remove('db-fields-row--dragging');
				dragSrc = null;
			});
			row.addEventListener('dragover', (e) => {
				e.preventDefault();
				e.dataTransfer!.dropEffect = 'move';
				row.classList.add('db-fields-row--over');
			});
			row.addEventListener('dragleave', () => {
				row.classList.remove('db-fields-row--over');
			});
			row.addEventListener('drop', (e) => {
				e.preventDefault();
				row.classList.remove('db-fields-row--over');
				if (!dragSrc || dragSrc === fieldId) { return; }
				const srcIdx = order.indexOf(dragSrc);
				const dstIdx = order.indexOf(fieldId);
				if (srcIdx < 0 || dstIdx < 0) { return; }
				order.splice(srcIdx, 1);
				order.splice(dstIdx, 0, dragSrc);
				flush();
				render();
			});
		}

		// Hide all / Show all
		const actions = append(panel, $('div.db-panel-add'));
		clearNode(actions);
		const hideAllBtn = append(actions, $('button.db-btn'));
		hideAllBtn.textContent = 'Hide all';
		hideAllBtn.addEventListener('click', () => {
			for (const f of schema) { hidden.add(f.id); }
			flush();
			render();
		});
		const showAllBtn = append(actions, $('button.db-btn'));
		showAllBtn.textContent = 'Show all';
		showAllBtn.addEventListener('click', () => {
			hidden.clear();
			flush();
			render();
		});
		if (onManageFields) {
			const manageBtn = append(actions, $('button.db-btn'));
			manageBtn.textContent = 'Manage fields...';
			manageBtn.addEventListener('click', () => {
				panel.remove();
				onManageFields();
			});
		}
	}

	function flush(): void {
		view.fieldOrder = [...order];
		view.hiddenFields = [...hidden];
		onChange();
	}

	render();

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
}

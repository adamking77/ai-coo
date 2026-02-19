/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Database, DBView, Field, FieldType, RollupAggregation } from '../common/database.js';

const FIELD_TYPES: FieldType[] = [
	'text', 'number', 'select', 'multiselect', 'relation', 'rollup', 'formula', 'status', 'date', 'checkbox', 'url', 'email', 'phone',
];
const HAS_OPTIONS: FieldType[] = ['select', 'multiselect', 'status'];
const ROLLUP_AGGREGATIONS: RollupAggregation[] = ['count', 'count_not_empty', 'sum', 'avg', 'min', 'max'];

export interface SchemaEditorOptions {
	databases?: Array<{ id: string; name: string }>;
	relationFieldsByDatabaseId?: Record<string, Array<{ id: string; name: string }>>;
	fieldsByDatabaseId?: Record<string, Array<{ id: string; name: string; type: FieldType }>>;
	currentView?: DBView;
}

export function showSchemaEditor(
	container: HTMLElement,
	db: Database,
	onSave: (schema: Field[]) => void,
	onClose: () => void,
	options?: SchemaEditorOptions,
): void {
	const overlay = append(container, $('div.db-schema-overlay'));
	overlay.addEventListener('click', e => { if (e.target === overlay) { close(); } });

	const panel = append(overlay, $('div.db-schema-panel'));

	// Header
	const header = append(panel, $('div.db-schema-header'));
	const title = append(header, $('h3.db-schema-title'));
	title.textContent = 'Manage Fields';
	const closeBtn = append(header, $('button.db-icon-btn'));
	closeBtn.textContent = '✕';
	closeBtn.title = 'Close';
	closeBtn.addEventListener('click', close);

	// Working copy
	let schema: Field[] = db.schema.map(f => ({
		...f,
		options: f.options ? [...f.options] : undefined,
	}));
	const hiddenInView = new Set<string>(options?.currentView?.hiddenFields ?? []);

	const listEl = append(panel, $('div.db-schema-list'));
	let dragSrc: Field | null = null;

	function renderList(): void {
		clearNode(listEl);

		for (const field of schema) {
			const row = append(listEl, $('div.db-schema-row'));
			row.draggable = true;

			// Drag handle
			const handle = append(row, $('span.db-fields-handle'));
			handle.textContent = '⠿';

			// View visibility toggle (for active view only)
			if (options?.currentView) {
				const visibleToggle = append(row, $('input')) as HTMLInputElement;
				visibleToggle.type = 'checkbox';
				visibleToggle.title = 'Visible in current view';
				visibleToggle.checked = !hiddenInView.has(field.id);
				visibleToggle.addEventListener('change', () => {
					if (visibleToggle.checked) {
						hiddenInView.delete(field.id);
					} else {
						hiddenInView.add(field.id);
					}
				});
			}

			row.addEventListener('dragstart', () => { dragSrc = field; row.classList.add('db-fields-row--dragging'); });
			row.addEventListener('dragend', () => { row.classList.remove('db-fields-row--dragging'); dragSrc = null; });
			row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('db-fields-row--over'); });
			row.addEventListener('dragleave', () => row.classList.remove('db-fields-row--over'));
			row.addEventListener('drop', e => {
				e.preventDefault();
				row.classList.remove('db-fields-row--over');
				if (!dragSrc || dragSrc === field) { return; }
				const srcIdx = schema.indexOf(dragSrc);
				const dstIdx = schema.indexOf(field);
				if (srcIdx < 0 || dstIdx < 0) { return; }
				schema.splice(srcIdx, 1);
				schema.splice(dstIdx, 0, dragSrc);
				renderList();
			});

			// Name input
			const nameInput = append(row, $('input.db-input.db-schema-name')) as HTMLInputElement;
			nameInput.value = field.name;
			nameInput.addEventListener('change', () => {
				field.name = nameInput.value.trim() || field.name;
			});

			// Type select
			const typeSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
			for (const t of FIELD_TYPES) {
				const o = append(typeSelect, $('option', { value: t })) as HTMLOptionElement;
				o.textContent = t;
				if (t === field.type) { o.selected = true; }
			}
			typeSelect.addEventListener('change', () => {
				field.type = typeSelect.value as FieldType;
				if (!HAS_OPTIONS.includes(field.type)) { delete field.options; }
				if (!HAS_OPTIONS.includes(field.type)) { delete field.optionColors; }
				if (field.type === 'status' && !field.options) {
					field.options = ['Not started', 'In progress', 'Done'];
				}
				if (field.type !== 'relation') { delete field.relation; }
				if (field.type !== 'rollup') { delete field.rollup; }
				if (field.type !== 'formula') { delete field.formula; }
				renderList();
			});

			// Options input
			if (HAS_OPTIONS.includes(field.type)) {
				const optInput = append(row, $('input.db-input.db-schema-options')) as HTMLInputElement;
				optInput.placeholder = 'Options (comma separated)';
				optInput.value = (field.options ?? []).join(', ');
				optInput.addEventListener('change', () => {
					const options = optInput.value.split(',').map(s => s.trim()).filter(Boolean);
					const optionColors: Record<string, string> = {};
					for (const option of options) {
						const color = field.optionColors?.[option];
						if (color) {
							optionColors[option] = color;
						}
					}
					field.options = options;
					field.optionColors = Object.keys(optionColors).length ? optionColors : undefined;
				});
			}

			if (field.type === 'relation') {
				field.relation ??= {};
				const targetDbSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
				append(targetDbSelect, $('option', { value: '' }, 'Current database'));
				for (const database of options?.databases ?? []) {
					const option = append(targetDbSelect, $('option', { value: database.id })) as HTMLOptionElement;
					option.textContent = database.name;
					if (field.relation.targetDatabaseId === database.id) { option.selected = true; }
				}
				targetDbSelect.addEventListener('change', () => {
					field.relation = { ...field.relation, targetDatabaseId: targetDbSelect.value || undefined };
					if (!field.relation.targetDatabaseId) {
						delete field.relation.targetRelationFieldId;
					}
					renderList();
				});

				const resolvedTargetDbId = field.relation.targetDatabaseId ?? db.id;
				const relationFieldSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
				append(relationFieldSelect, $('option', { value: '' }, 'No backlink'));
				const availableRelationFields = options?.relationFieldsByDatabaseId?.[resolvedTargetDbId] ?? [];
				for (const relationField of availableRelationFields) {
					const option = append(relationFieldSelect, $('option', { value: relationField.id })) as HTMLOptionElement;
					option.textContent = relationField.name;
					if (field.relation.targetRelationFieldId === relationField.id) { option.selected = true; }
				}
				relationFieldSelect.addEventListener('change', () => {
					field.relation = { ...field.relation, targetRelationFieldId: relationFieldSelect.value || undefined };
				});
			}

			if (field.type === 'rollup') {
				field.rollup ??= { relationFieldId: '', aggregation: 'count' };

				const relationSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
				append(relationSelect, $('option', { value: '' }, 'Relation field'));
				for (const relationField of schema.filter(candidate => candidate.type === 'relation')) {
					const option = append(relationSelect, $('option', { value: relationField.id })) as HTMLOptionElement;
					option.textContent = relationField.name;
					if (field.rollup.relationFieldId === relationField.id) { option.selected = true; }
				}
				relationSelect.addEventListener('change', () => {
					field.rollup = { ...field.rollup!, relationFieldId: relationSelect.value };
					delete field.rollup.targetFieldId;
					renderList();
				});

				const aggSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
				for (const aggregation of ROLLUP_AGGREGATIONS) {
					const option = append(aggSelect, $('option', { value: aggregation })) as HTMLOptionElement;
					option.textContent = aggregation;
					if (field.rollup.aggregation === aggregation) { option.selected = true; }
				}
				aggSelect.addEventListener('change', () => {
					field.rollup = { ...field.rollup!, aggregation: aggSelect.value as RollupAggregation };
					if (field.rollup.aggregation === 'count') {
						delete field.rollup.targetFieldId;
					}
					renderList();
				});

				const targetFieldSelect = append(row, $('select.db-select.db-schema-type')) as HTMLSelectElement;
				append(targetFieldSelect, $('option', { value: '' }, 'Target field'));
				const relationField = schema.find(candidate => candidate.id === field.rollup?.relationFieldId && candidate.type === 'relation');
				const relationTargetDbId = relationField?.relation?.targetDatabaseId ?? db.id;
				const targetFields = options?.fieldsByDatabaseId?.[relationTargetDbId]
					?? schema
						.filter(candidate => candidate.id !== field.id)
						.map(candidate => ({ id: candidate.id, name: candidate.name, type: candidate.type }));
				const numericOnly = field.rollup.aggregation === 'sum' || field.rollup.aggregation === 'avg' || field.rollup.aggregation === 'min' || field.rollup.aggregation === 'max';
				for (const targetField of targetFields) {
					if (numericOnly && targetField.type !== 'number') { continue; }
					const option = append(targetFieldSelect, $('option', { value: targetField.id })) as HTMLOptionElement;
					option.textContent = targetField.name;
					if (field.rollup.targetFieldId === targetField.id) { option.selected = true; }
				}
				targetFieldSelect.addEventListener('change', () => {
					field.rollup = { ...field.rollup!, targetFieldId: targetFieldSelect.value || undefined };
				});
			}

			if (field.type === 'formula') {
				field.formula ??= { expression: '' };
				const expressionInput = append(row, $('input.db-input.db-schema-options')) as HTMLInputElement;
				expressionInput.placeholder = 'Formula (use {fieldId} references)';
				expressionInput.value = field.formula.expression;
				expressionInput.addEventListener('change', () => {
					field.formula = { expression: expressionInput.value };
				});
			}

			// Delete
			const deleteBtn = append(row, $('button.db-icon-btn.db-schema-delete'));
			deleteBtn.textContent = '🗑';
			deleteBtn.title = 'Delete field';
			deleteBtn.addEventListener('click', () => {
				const idx = schema.indexOf(field);
				if (idx >= 0) { schema.splice(idx, 1); }
				renderList();
			});
		}

		// Add field form
		const addSection = append(listEl, $('div.db-schema-add'));
		const addTitle = append(addSection, $('div.db-schema-add-title'));
		addTitle.textContent = 'Add Field';

		const addRow = append(addSection, $('div.db-schema-add-row'));
		const nameInput = append(addRow, $('input.db-input')) as HTMLInputElement;
		nameInput.placeholder = 'Field name';

		const typeSelect = append(addRow, $('select.db-select')) as HTMLSelectElement;
		for (const t of FIELD_TYPES) {
			const o = append(typeSelect, $('option', { value: t })) as HTMLOptionElement;
			o.textContent = t;
		}

		const addBtn = append(addRow, $('button.db-btn'));
		addBtn.textContent = 'Add';
		addBtn.addEventListener('click', () => {
			const name = nameInput.value.trim();
			if (!name) { nameInput.focus(); return; }
			const type = typeSelect.value as FieldType;
			const newField: Field = { id: generateUuid(), name, type };
			if (type === 'status') { newField.options = ['Not started', 'In progress', 'Done']; }
			if (type === 'relation') { newField.relation = {}; }
			if (type === 'rollup') { newField.rollup = { relationFieldId: '', aggregation: 'count' }; }
			if (type === 'formula') { newField.formula = { expression: '' }; }
			schema.push(newField);
			nameInput.value = '';
			renderList();
		});
		nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { addBtn.click(); } });
	}

	renderList();

	// Footer
	const footer = append(panel, $('div.db-schema-footer'));
	if (options?.currentView) {
		const showAllBtn = append(footer, $('button.db-btn'));
		showAllBtn.textContent = 'Show all in view';
		showAllBtn.addEventListener('click', () => {
			hiddenInView.clear();
			renderList();
		});
		const hideAllBtn = append(footer, $('button.db-btn'));
		hideAllBtn.textContent = 'Hide all in view';
		hideAllBtn.addEventListener('click', () => {
			for (const field of schema) {
				hiddenInView.add(field.id);
			}
			renderList();
		});
	}
	const saveBtn = append(footer, $('button.db-btn.db-btn-primary'));
	saveBtn.textContent = 'Save Changes';
	saveBtn.addEventListener('click', () => {
		if (options?.currentView) {
			const validIds = new Set(schema.map(field => field.id));
			options.currentView.hiddenFields = [...hiddenInView].filter(id => validIds.has(id));
		}
		onSave(schema);
		close();
	});
	const cancelBtn = append(footer, $('button.db-btn'));
	cancelBtn.textContent = 'Cancel';
	cancelBtn.addEventListener('click', close);

	function close(): void {
		overlay.remove();
		onClose();
	}
}

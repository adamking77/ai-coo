/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { Database, DatabaseResolver, DBRecord, Field, getFieldOptionColor, getFieldValue, getReadableTextColor, getRecordTitle, getRelationTargetDatabase, getStatusColor, STATUS_OPTIONS } from '../common/database.js';

export interface RecordEditorCallbacks {
	onSave: (updated: DBRecord) => void;
	onDelete: (record: DBRecord) => void;
	onDuplicate: (record: DBRecord) => void;
	onOpenFullPage?: (record: DBRecord) => void;
	onCreateRelatedRecord?: (relationFieldId: string, targetDatabaseId: string, title: string, sourceRecordId: string) => Promise<string | undefined>;
	onOpenRelatedRecord?: (databaseId: string, recordId: string, options?: { newTab?: boolean }) => Promise<void>;
	onClose: () => void;
}

type PickerOption = { id: string; label: string; color?: string };

let lastPanelWidth = 520;

export function showRecordEditor(
	container: HTMLElement,
	record: DBRecord,
	db: Database,
	callbacks: RecordEditorCallbacks,
	resolveDatabase?: DatabaseResolver,
	mode: 'panel' | 'fullpage' = 'panel',
): void {
	container.querySelector('.db-record-panel')?.remove();

	const panel = append(container, $('div.db-record-panel'));
	const resizeHandle = append(panel, $('div.db-record-resize-handle'));
	if (mode === 'fullpage') {
		panel.classList.add('db-record-panel--fullpage');
	} else {
		panel.style.width = `${lastPanelWidth}px`;
	}
	const working: DBRecord = { ...record };
	const titleField = db.schema.find(field => field.type === 'text');

	const header = append(panel, $('div.db-record-header'));
	const titleWrap = append(header, $('div.db-record-title-wrap'));
	const icon = append(titleWrap, $('button.db-record-icon-btn')) as HTMLButtonElement;
	icon.textContent = '◻';
	icon.title = 'Record icon';
	const titleInput = append(titleWrap, $('input.db-record-title-input')) as HTMLInputElement;
	titleInput.value = getRecordTitle(record, db.schema);
	titleInput.placeholder = 'Untitled';
	titleInput.addEventListener('input', () => {
		if (titleField) {
			working[titleField.id] = titleInput.value || null;
		}
	});

	const headerActions = append(header, $('div.db-record-header-actions'));
	if (mode === 'panel') {
		const toggleWidthBtn = append(headerActions, $('button.db-icon-btn'));
		toggleWidthBtn.textContent = '↔';
		toggleWidthBtn.title = 'Resize panel';
		toggleWidthBtn.addEventListener('click', () => {
			if (panel.classList.contains('db-record-panel--fullpage')) {
				return;
			}
			const compactWidth = 440;
			const expandedWidth = Math.min(Math.floor(window.innerWidth * 0.72), 1040);
			const currentWidth = panel.getBoundingClientRect().width;
			const nextWidth = currentWidth < ((compactWidth + expandedWidth) / 2) ? expandedWidth : compactWidth;
			lastPanelWidth = nextWidth;
			panel.style.width = `${nextWidth}px`;
		});

		if (callbacks.onOpenFullPage) {
			const fullPageBtn = append(headerActions, $('button.db-icon-btn'));
			fullPageBtn.textContent = '⛶';
			fullPageBtn.title = 'Open as page';
			fullPageBtn.addEventListener('click', () => {
				void callbacks.onOpenFullPage?.(record);
				close();
			});
		}
	}

	const dupBtn = append(headerActions, $('button.db-icon-btn'));
	dupBtn.textContent = '⧉';
	dupBtn.title = 'Duplicate record';
	dupBtn.addEventListener('click', () => callbacks.onDuplicate(record));
	const closeBtn = append(headerActions, $('button.db-icon-btn'));
	closeBtn.textContent = '✕';
	closeBtn.title = 'Close';
	closeBtn.addEventListener('click', close);

	const meta = append(panel, $('div.db-record-meta'));
	renderMetaRow(meta, db, working);

	const body = append(panel, $('div.db-record-body'));
	const propertiesSection = append(body, $('section.db-record-section'));
	append(propertiesSection, $('h4.db-record-section-title')).textContent = 'Properties';
	const propertiesList = append(propertiesSection, $('div.db-record-prop-list'));

	for (const field of db.schema) {
		if (titleField && field.id === titleField.id) {
			continue;
		}
		const row = append(propertiesList, $('div.db-record-prop-row'));
		append(row, $('div.db-record-prop-label')).textContent = field.name;
		const valueCell = append(row, $('div.db-record-prop-value'));
		renderPropertyEditor(valueCell, field, working, db, callbacks, resolveDatabase, () => {
			renderMetaRow(meta, db, working);
			if (titleField) {
				titleInput.value = getRecordTitle(working, db.schema);
			}
		});
	}

	const taskSection = append(body, $('section.db-record-section'));
	append(taskSection, $('h4.db-record-section-title')).textContent = 'Tasks';
	renderRelatedTasksSection(taskSection, working, db, callbacks, resolveDatabase, () => {
		renderMetaRow(meta, db, working);
		if (titleField) {
			titleInput.value = getRecordTitle(working, db.schema);
		}
	});

	const contentSection = append(body, $('section.db-record-section'));
	append(contentSection, $('h4.db-record-section-title')).textContent = 'Content';
	const editor = append(contentSection, $('div.db-record-editor'));
	const toolbar = append(editor, $('div.db-record-editor-toolbar'));
	const notes = append(editor, $('textarea.db-input.db-input-textarea.db-record-notes')) as HTMLTextAreaElement;
	const notesMeta = append(editor, $('div.db-record-editor-meta'));
	const wordCount = append(notesMeta, $('span.db-record-editor-count'));
	notes.value = working._body ?? '';
	notes.placeholder = 'Type notes, ideas, and context...';
	notes.rows = 10;
	notes.addEventListener('input', () => {
		working._body = notes.value || undefined;
		updateWordCount();
	});
	addNotesToolbar(toolbar, notes);
	updateWordCount();

	const footer = append(panel, $('div.db-record-footer'));
	const deleteBtn = append(footer, $('button.db-btn.db-btn-danger'));
	deleteBtn.textContent = 'Delete';
	deleteBtn.addEventListener('click', () => {
		if (confirm('Delete this record?')) {
			callbacks.onDelete(working);
			close();
		}
	});
	append(footer, $('span.db-toolbar-spacer'));
	const cancelBtn = append(footer, $('button.db-btn'));
	cancelBtn.textContent = 'Cancel';
	cancelBtn.addEventListener('click', close);
	const saveBtn = append(footer, $('button.db-btn.db-btn-primary'));
	saveBtn.textContent = 'Save';
	saveBtn.addEventListener('click', saveAndClose);

	panel.addEventListener('keydown', (event: KeyboardEvent) => {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			saveAndClose();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	});

	titleInput.focus();
	titleInput.select();
	if (mode === 'panel') {
		enablePanelResize(panel, resizeHandle);
	}

	function saveAndClose(): void {
		callbacks.onSave(working);
		close();
	}

	function close(): void {
		panel.remove();
		callbacks.onClose();
	}

	function updateWordCount(): void {
		const text = notes.value.trim();
		const words = text ? text.split(/\s+/).length : 0;
		wordCount.textContent = `${words} words`;
	}
}

function enablePanelResize(panel: HTMLElement, resizeHandle: HTMLElement): void {
	resizeHandle.addEventListener('mousedown', (event: MouseEvent) => {
		if (panel.classList.contains('db-record-panel--fullpage')) {
			return;
		}
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = panel.getBoundingClientRect().width;
		const min = 420;
		const max = Math.max(min, Math.floor(window.innerWidth * 0.9));

		const onMove = (moveEvent: MouseEvent) => {
			const next = Math.max(min, Math.min(max, startWidth + (startX - moveEvent.clientX)));
			lastPanelWidth = next;
			panel.style.width = `${next}px`;
		};
		const onUp = () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	});
}

function renderMetaRow(meta: HTMLElement, db: Database, record: DBRecord): void {
	clearNode(meta);
	const createdAtField = db.schema.find(field => field.type === 'createdAt');
	const editedAtField = db.schema.find(field => field.type === 'lastEditedAt');
	if (!createdAtField && !editedAtField) {
		meta.style.display = 'none';
		return;
	}
	meta.style.display = 'flex';

	if (createdAtField) {
		const created = append(meta, $('span.db-record-meta-item'));
		created.textContent = `Created ${formatDate(record[createdAtField.id])}`;
	}
	if (editedAtField) {
		const edited = append(meta, $('span.db-record-meta-item'));
		edited.textContent = `Edited ${formatDate(record[editedAtField.id])}`;
	}
}

function formatDate(value: string | number | boolean | string[] | null | undefined): string {
	if (!value || Array.isArray(value) || typeof value === 'boolean') {
		return '—';
	}
	try {
		return new Date(String(value)).toLocaleString();
	} catch {
		return String(value);
	}
}

function renderPropertyEditor(
	container: HTMLElement,
	field: Field,
	working: DBRecord,
	db: Database,
	callbacks: RecordEditorCallbacks,
	resolveDatabase: DatabaseResolver | undefined,
	onChanged: () => void,
): void {
	clearNode(container);
	const value = working[field.id];

	if (field.type === 'createdAt' || field.type === 'lastEditedAt' || field.type === 'rollup' || field.type === 'formula') {
		const auto = append(container, $('span.db-record-auto-value'));
		const computed = getFieldValue(working, field, db, resolveDatabase);
		auto.textContent = computed == null ? '—' : (Array.isArray(computed) ? computed.join(', ') : String(computed));
		return;
	}

	if (field.type === 'checkbox') {
		const toggle = append(container, $('input')) as HTMLInputElement;
		toggle.type = 'checkbox';
		toggle.className = 'db-input-check';
		toggle.checked = Boolean(value);
		toggle.addEventListener('change', () => {
			working[field.id] = toggle.checked;
			onChanged();
		});
		return;
	}

	if (field.type === 'status' || field.type === 'select') {
		const options = (field.type === 'status' ? (field.options ?? STATUS_OPTIONS) : (field.options ?? []))
			.map(option => ({
				id: option,
				label: option,
				color: field.type === 'status' ? getStatusColor(option) : getFieldOptionColor(field, option),
			}));
		renderSingleChipPicker(container, value && typeof value === 'string' ? value : null, options, nextValue => {
			working[field.id] = nextValue;
			onChanged();
		});
		return;
	}

	if (field.type === 'multiselect') {
		const selected = new Set<string>(Array.isArray(value) ? value : []);
		renderChipPicker(container, selected, (field.options ?? []).map(option => ({
			id: option,
			label: option,
			color: getFieldOptionColor(field, option),
		})), () => {
			working[field.id] = [...selected];
			onChanged();
		});
		return;
	}

	if (field.type === 'relation') {
		renderRelationProperty(container, field, working, db, callbacks, resolveDatabase, onChanged);
		return;
	}

	const inputType =
		field.type === 'number' ? 'number' :
		field.type === 'date' ? 'date' :
		field.type === 'url' ? 'url' :
		field.type === 'email' ? 'email' :
		field.type === 'phone' ? 'tel' : 'text';

	if (field.type === 'text') {
		const ta = append(container, $('textarea.db-input.db-input-textarea')) as HTMLTextAreaElement;
		ta.value = value != null ? String(value) : '';
		ta.rows = 2;
		ta.addEventListener('input', () => {
			working[field.id] = ta.value || null;
			onChanged();
		});
		return;
	}

	const input = append(container, $('input.db-input')) as HTMLInputElement;
	input.type = inputType;
	input.value = value != null ? String(value) : '';
	input.addEventListener('input', () => {
		working[field.id] = field.type === 'number' && input.value ? Number(input.value) : (input.value || null);
		onChanged();
	});
}

function renderRelationProperty(
	container: HTMLElement,
	field: Field,
	working: DBRecord,
	db: Database,
	callbacks: RecordEditorCallbacks,
	resolveDatabase: DatabaseResolver | undefined,
	onChanged: () => void,
): void {
	const relationRoot = append(container, $('div.db-relation-prop'));
	const list = append(relationRoot, $('div.db-relation-prop-list'));
	const actions = append(relationRoot, $('div.db-relation-prop-actions'));
	const linkExistingBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
	linkExistingBtn.type = 'button';
	linkExistingBtn.textContent = 'Add existing';
	const createBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
	createBtn.type = 'button';
	createBtn.textContent = 'New related page';

	const targetDb = getRelationTargetDatabase(db, field, resolveDatabase);
	const candidates = targetDb.records
		.filter(candidate => !(targetDb.id === db.id && candidate.id === working.id))
		.map(candidate => ({ id: candidate.id, label: getRecordTitle(candidate, targetDb.schema) }));

	const renderList = () => {
		clearNode(list);
		const linkedIds = Array.isArray(working[field.id]) ? (working[field.id] as string[]) : [];
		if (!linkedIds.length) {
			const empty = append(list, $('span.db-record-auto-value'));
			empty.textContent = 'No related pages';
			return;
		}
		const statusField = targetDb.schema.find(schemaField => schemaField.type === 'status');
		const dueField = targetDb.schema.find(schemaField => schemaField.type === 'date');
		for (const linkedId of linkedIds) {
			const linked = targetDb.records.find(candidate => candidate.id === linkedId);
			if (!linked) {
				continue;
			}
			const row = append(list, $('button.db-relation-prop-row')) as HTMLButtonElement;
			row.type = 'button';
			const title = append(row, $('span.db-relation-prop-title'));
			title.textContent = getRecordTitle(linked, targetDb.schema);

			if (statusField) {
				const statusValue = linked[statusField.id];
				if (typeof statusValue === 'string' && statusValue) {
					const statusBadge = append(row, $('span.db-select-badge'));
					statusBadge.textContent = statusValue;
					const bg = getStatusColor(statusValue);
					statusBadge.style.backgroundColor = bg;
					statusBadge.style.color = getReadableTextColor(bg);
				}
			}

			if (dueField) {
				const dueValue = linked[dueField.id];
				if (typeof dueValue === 'string' && dueValue) {
					const due = append(row, $('span.db-relation-prop-meta'));
					due.textContent = dueValue;
				}
			}

			const removeBtn = append(row, $('button.db-icon-btn')) as HTMLButtonElement;
			removeBtn.type = 'button';
			removeBtn.textContent = '✕';
			removeBtn.title = 'Remove relation';
			removeBtn.addEventListener('click', event => {
				event.stopPropagation();
				const next = linkedIds.filter(id => id !== linkedId);
				working[field.id] = next;
				onChanged();
				renderList();
			});

			if (callbacks.onOpenRelatedRecord) {
				row.addEventListener('click', event => {
					const mouse = event as MouseEvent;
					void callbacks.onOpenRelatedRecord?.(targetDb.id, linked.id, {
						newTab: Boolean(mouse.metaKey || mouse.ctrlKey),
					});
				});
			}
		}
	};

	linkExistingBtn.addEventListener('click', event => {
		event.stopPropagation();
		showOptionPicker(linkExistingBtn, {
			multi: true,
			options: candidates,
			selected: Array.isArray(working[field.id]) ? [...working[field.id] as string[]] : [],
			onChange: selected => {
				working[field.id] = selected;
				onChanged();
				renderList();
			},
		});
	});

	createBtn.addEventListener('click', async event => {
		event.stopPropagation();
		showCreateRelatedPopover(createBtn, `New ${targetDb.name} item`, async title => {
			const createdId = await callbacks.onCreateRelatedRecord?.(field.id, targetDb.id, title.trim(), working.id);
			if (!createdId) {
				return;
			}
			const next = new Set<string>(Array.isArray(working[field.id]) ? (working[field.id] as string[]) : []);
			next.add(createdId);
			working[field.id] = [...next];
			onChanged();
			renderList();
		});
	});

	renderList();
}

function renderSingleChipPicker(
	container: HTMLElement,
	selectedValue: string | null,
	options: PickerOption[],
	onValueChange: (nextValue: string | null) => void,
): void {
	const row = append(container, $('div.db-record-chip-row'));
	const chips = append(row, $('div.db-record-chip-list'));
	chips.classList.add('db-record-chip-list--clickable');
	chips.title = 'Edit value';

	const render = () => {
		clearNode(chips);
		if (!selectedValue) {
			const empty = append(chips, $('span.db-select-badge.db-select-badge--empty'));
			empty.textContent = 'Select option';
			return;
		}
		const option = options.find(candidate => candidate.id === selectedValue);
		const badge = append(chips, $('span.db-select-badge'));
		badge.textContent = option?.label ?? selectedValue;
		if (option?.color) {
			badge.style.backgroundColor = option.color;
			badge.style.color = getReadableTextColor(option.color);
		}
	};

	render();
	chips.addEventListener('click', event => {
		event.stopPropagation();
		showOptionPicker(chips, {
			multi: false,
			options,
			selected: selectedValue ? [selectedValue] : [],
			onChange: selected => {
				selectedValue = selected[0] ?? null;
				onValueChange(selectedValue);
				render();
			},
		});
	});
}

function renderChipPicker(
	container: HTMLElement,
	selected: Set<string>,
	options: PickerOption[],
	onSelectedChange: () => void,
): void {
	const row = append(container, $('div.db-record-chip-row'));
	const chips = append(row, $('div.db-record-chip-list'));
	chips.classList.add('db-record-chip-list--clickable');
	chips.title = 'Edit values';

	const renderChips = () => {
		clearNode(chips);
		if (!selected.size) {
			const empty = append(chips, $('span.db-select-badge.db-select-badge--empty'));
			empty.textContent = 'Select options';
			return;
		}
		const optionById = new Map(options.map(option => [option.id, option]));
		for (const item of selected) {
			const badge = append(chips, $('span.db-select-badge'));
			const option = optionById.get(item);
			badge.textContent = option?.label ?? item;
			if (option?.color) {
				badge.style.backgroundColor = option.color;
				badge.style.color = getReadableTextColor(option.color);
			}
		}
	};

	renderChips();
	chips.addEventListener('click', event => {
		event.stopPropagation();
		showOptionPicker(chips, {
			multi: true,
			options,
			selected: [...selected],
			onChange: nextSelected => {
				selected.clear();
				for (const item of nextSelected) {
					selected.add(item);
				}
				renderChips();
				onSelectedChange();
			},
		});
	});
}

function addNotesToolbar(toolbar: HTMLElement, notes: HTMLTextAreaElement): void {
	const actions: Array<{ label: string; title: string; onClick: () => void }> = [
		{ label: 'B', title: 'Bold', onClick: () => wrapSelection(notes, '**', '**') },
		{ label: 'I', title: 'Italic', onClick: () => wrapSelection(notes, '*', '*') },
		{ label: 'H1', title: 'Heading 1', onClick: () => prefixLines(notes, '# ') },
		{ label: 'H2', title: 'Heading 2', onClick: () => prefixLines(notes, '## ') },
		{ label: '• List', title: 'Bulleted list', onClick: () => prefixLines(notes, '- ') },
		{ label: '☐ Todo', title: 'Todo list', onClick: () => prefixLines(notes, '- [ ] ') },
		{ label: 'Link', title: 'Insert link', onClick: () => wrapSelection(notes, '[', '](url)') },
	];

	for (const action of actions) {
		const button = append(toolbar, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		button.type = 'button';
		button.textContent = action.label;
		button.title = action.title;
		button.addEventListener('click', event => {
			event.preventDefault();
			action.onClick();
		});
	}
}

function wrapSelection(textarea: HTMLTextAreaElement, prefix: string, suffix: string): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const value = textarea.value;
	const selected = value.slice(start, end);
	const next = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
	textarea.value = next;
	const cursor = start + prefix.length + selected.length + suffix.length;
	textarea.setSelectionRange(cursor, cursor);
	textarea.dispatchEvent(new Event('input'));
	textarea.focus();
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const value = textarea.value;
	const selected = value.slice(start, end) || value;
	const prefixed = selected
		.split('\n')
		.map(line => `${prefix}${line}`)
		.join('\n');
	const next = value.slice(start, end) ? `${value.slice(0, start)}${prefixed}${value.slice(end)}` : prefixed;
	textarea.value = next;
	const cursor = start + prefixed.length;
	textarea.setSelectionRange(cursor, cursor);
	textarea.dispatchEvent(new Event('input'));
	textarea.focus();
}

function showOptionPicker(
	anchor: HTMLElement,
	options: {
		multi: boolean;
		options: PickerOption[];
		selected: string[];
		onChange: (selected: string[]) => void;
	},
): void {
	document.querySelector('.db-record-picker-panel')?.remove();

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-record-picker-panel';
	document.body.appendChild(panel);

	const search = append(panel, $('input.db-input')) as HTMLInputElement;
	search.placeholder = 'Search...';	
	const list = append(panel, $('div.db-record-picker-list'));

	const selected = new Set(options.selected);

	const renderList = () => {
		clearNode(list);
		const query = search.value.trim().toLowerCase();
		const filtered = options.options.filter(option => option.label.toLowerCase().includes(query));
		if (!filtered.length) {
			const empty = append(list, $('div.db-panel-empty'));
			empty.textContent = 'No matches';
			return;
		}
		for (const option of filtered) {
			const item = append(list, $('button.db-record-picker-item')) as HTMLButtonElement;
			item.type = 'button';
			const mark = append(item, $('span.db-record-picker-mark'));
			mark.textContent = selected.has(option.id) ? '✓' : ' '; 
			const label = append(item, $('span.db-record-picker-label'));
			label.textContent = option.label;
			if (option.color) {
				label.style.backgroundColor = option.color;
				label.style.color = getReadableTextColor(option.color);
				label.classList.add('db-record-picker-label--color');
			}
			item.addEventListener('click', () => {
				if (options.multi) {
					if (selected.has(option.id)) {
						selected.delete(option.id);
					} else {
						selected.add(option.id);
					}
					options.onChange([...selected]);
					renderList();
				} else {
					options.onChange([option.id]);
					close();
				}
			});
		}
	};

	search.addEventListener('input', renderList);

	if (options.multi) {
		const actions = append(panel, $('div.db-panel-add'));
		const clearBtn = append(actions, $('button.db-btn'));
		clearBtn.textContent = 'Clear';
		clearBtn.addEventListener('click', () => {
			selected.clear();
			options.onChange([]);
			renderList();
		});
		const doneBtn = append(actions, $('button.db-btn.db-btn-primary'));
		doneBtn.textContent = 'Done';
		doneBtn.addEventListener('click', close);
	}

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;
	search.focus();
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

function renderRelatedTasksSection(
	container: HTMLElement,
	working: DBRecord,
	db: Database,
	callbacks: RecordEditorCallbacks,
	resolveDatabase: DatabaseResolver | undefined,
	onChanged: () => void,
): void {
	const taskRelations = db.schema.filter(field => field.type === 'relation' && isTaskRelation(field, resolveDatabase, db));
	if (!taskRelations.length) {
		const empty = append(container, $('div.db-record-auto-value'));
		empty.textContent = 'Add a relation to a Tasks database to manage tasks from this page.';
		return;
	}

	for (const relationField of taskRelations) {
		const card = append(container, $('div.db-related-tasks'));
		const head = append(card, $('div.db-related-tasks-head'));
		append(head, $('span.db-related-tasks-title')).textContent = relationField.name;
		const addBtn = append(head, $('button.db-btn')) as HTMLButtonElement;
		addBtn.textContent = '+ Task';

		const list = append(card, $('div.db-related-tasks-list'));
		const inlineCreate = append(card, $('div.db-related-task-inline-create'));
		inlineCreate.style.display = 'none';
		const inlineInput = append(inlineCreate, $('input.db-input')) as HTMLInputElement;
		inlineInput.placeholder = 'Task title';
		const inlineActions = append(inlineCreate, $('div.db-related-task-inline-actions'));
		const inlineCancel = append(inlineActions, $('button.db-btn')) as HTMLButtonElement;
		inlineCancel.textContent = 'Cancel';
		const inlineCreateBtn = append(inlineActions, $('button.db-btn.db-btn-primary')) as HTMLButtonElement;
		inlineCreateBtn.textContent = 'Create';
		inlineCancel.addEventListener('click', () => {
			inlineCreate.style.display = 'none';
			inlineInput.value = '';
		});

		const renderList = () => {
			clearNode(list);
			const targetDb = getRelationTargetDatabase(db, relationField, resolveDatabase);
			const linkedIds = new Set<string>(Array.isArray(working[relationField.id]) ? (working[relationField.id] as string[]) : []);
			const backlinkFieldId = relationField.relation?.targetRelationFieldId;
			if (backlinkFieldId) {
				for (const candidate of targetDb.records) {
					const backlink = candidate[backlinkFieldId];
					if (Array.isArray(backlink) && backlink.includes(working.id)) {
						linkedIds.add(candidate.id);
					}
				}
			}
			if (!linkedIds.size) {
				const empty = append(list, $('div.db-record-auto-value'));
				empty.textContent = 'No related tasks';
				return;
			}
			const statusField = targetDb.schema.find(field => field.type === 'status');
			const dueField = targetDb.schema.find(field => field.type === 'date');
			for (const linkedId of linkedIds) {
				const linked = targetDb.records.find(record => record.id === linkedId);
				if (!linked) {
					continue;
				}
				const row = append(list, $('button.db-related-task-row')) as HTMLButtonElement;
				row.type = 'button';
				const title = append(row, $('span.db-related-task-title'));
				title.textContent = getRecordTitle(linked, targetDb.schema);
				if (statusField) {
					const statusValue = linked[statusField.id];
					if (typeof statusValue === 'string' && statusValue) {
						const badge = append(row, $('span.db-select-badge'));
						badge.textContent = statusValue;
						const bg = getStatusColor(statusValue);
						badge.style.backgroundColor = bg;
						badge.style.color = getReadableTextColor(bg);
					}
				}
				if (dueField) {
					const dueValue = linked[dueField.id];
					if (typeof dueValue === 'string' && dueValue) {
						const due = append(row, $('span.db-related-task-due'));
						due.textContent = dueValue;
					}
				}
				if (callbacks.onOpenRelatedRecord) {
					row.addEventListener('click', (event) => {
						const mouse = event as MouseEvent;
						void callbacks.onOpenRelatedRecord?.(targetDb.id, linked.id, {
							newTab: Boolean(mouse.metaKey || mouse.ctrlKey),
						});
					});
				}
			}
		};

		addBtn.addEventListener('click', () => {
			inlineCreate.style.display = '';
			inlineInput.focus();
			inlineInput.select();
		});

		const submitInlineCreate = async () => {
			const title = inlineInput.value.trim();
			if (!title) {
				inlineInput.focus();
				return;
			}
			const targetDb = getRelationTargetDatabase(db, relationField, resolveDatabase);
			inlineCreateBtn.disabled = true;
			try {
				const createdId = await callbacks.onCreateRelatedRecord?.(
					relationField.id,
					targetDb.id,
					title,
					working.id,
				);
				if (!createdId) {
					return;
				}
				const existing = new Set<string>(Array.isArray(working[relationField.id]) ? (working[relationField.id] as string[]) : []);
				existing.add(createdId);
				working[relationField.id] = [...existing];
				inlineInput.value = '';
				inlineCreate.style.display = 'none';
				onChanged();
				renderList();
			} finally {
				inlineCreateBtn.disabled = false;
			}
		};

		inlineCreateBtn.addEventListener('click', () => { void submitInlineCreate(); });
		inlineInput.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void submitInlineCreate();
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				inlineCreate.style.display = 'none';
				inlineInput.value = '';
			}
		});

		renderList();
	}
}

function isTaskRelation(field: Field, resolveDatabase: DatabaseResolver | undefined, sourceDb: Database): boolean {
	if (field.type !== 'relation') {
		return false;
	}
	const byName = /task/i.test(field.name);
	if (byName) {
		return true;
	}
	const targetDb = getRelationTargetDatabase(sourceDb, field, resolveDatabase);
	return /task/i.test(targetDb.name);
}

function showCreateRelatedPopover(
	anchor: HTMLElement,
	placeholder: string,
	onSubmit: (title: string) => Promise<void>,
): void {
	document.querySelector('.db-related-create-popover')?.remove();

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-related-create-popover';
	document.body.appendChild(panel);

	const input = append(panel, $('input.db-input')) as HTMLInputElement;
	input.placeholder = placeholder;
	const actions = append(panel, $('div.db-panel-add'));
	const cancelBtn = append(actions, $('button.db-btn')) as HTMLButtonElement;
	cancelBtn.textContent = 'Cancel';
	const createBtn = append(actions, $('button.db-btn.db-btn-primary')) as HTMLButtonElement;
	createBtn.textContent = 'Create';

	const close = () => panel.remove();
	const submit = async () => {
		const title = input.value.trim();
		if (!title) {
			input.focus();
			return;
		}
		createBtn.disabled = true;
		try {
			await onSubmit(title);
			close();
		} finally {
			createBtn.disabled = false;
		}
	};

	createBtn.addEventListener('click', () => { void submit(); });
	cancelBtn.addEventListener('click', close);
	input.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void submit();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	});

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;
	input.focus();

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

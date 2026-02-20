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
	onUpdateRelatedRecord?: (databaseId: string, recordId: string, fieldId: string, value: string | number | boolean | string[] | null) => Promise<void>;
	onUpdateHeaderFields?: (fieldIds: string[]) => Promise<void>;
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
	let hasPendingChanges = false;
	let isDeleting = false;

	const markDirty = () => {
		hasPendingChanges = true;
	};

	const persistIfNeeded = () => {
		if (!hasPendingChanges || isDeleting) {
			return;
		}
		callbacks.onSave(working);
		hasPendingChanges = false;
		renderMetaRow(meta, db, working);
	};

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
			markDirty();
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
				persistIfNeeded();
				void callbacks.onOpenFullPage?.(working);
				close();
			});
		}
	}

	const dupBtn = append(headerActions, $('button.db-icon-btn'));
	dupBtn.textContent = '⧉';
	dupBtn.title = 'Duplicate record';
	dupBtn.addEventListener('click', () => callbacks.onDuplicate(working));
	const closeBtn = append(headerActions, $('button.db-icon-btn'));
	closeBtn.textContent = '✕';
	closeBtn.title = 'Close';
	closeBtn.addEventListener('click', close);

	const meta = append(panel, $('div.db-record-meta'));
	renderMetaRow(meta, db, working);

	const body = append(panel, $('div.db-record-body'));
	const propertyFields = db.schema.filter(field => {
		if (titleField && field.id === titleField.id) {
			return false;
		}
		if (field.type === 'relation' && isTaskRelation(field, resolveDatabase, db)) {
			return false;
		}
		return true;
	});
	const keyFields = getKeyPropertyFields(propertyFields, resolveDatabase, db).slice(0, 5);
	const availableHeaderFieldIds = new Set(propertyFields.map(field => field.id));
	let headerFieldIds = (db.headerFieldIds ?? [])
		.filter(fieldId => availableHeaderFieldIds.has(fieldId))
		.slice(0, 5);
	let headerPickerOrder = [
		...headerFieldIds,
		...propertyFields.map(field => field.id).filter(fieldId => !headerFieldIds.includes(fieldId)),
	];

	const keySection = append(body, $('section.db-record-section.db-record-key-section'));
	const keyHead = append(keySection, $('div.db-record-key-head'));
	append(keyHead, $('h4.db-record-section-title')).textContent = 'Summary';
	const customizeKeyBtn = append(keyHead, $('button.db-btn.db-record-editor-btn.db-record-key-config-btn')) as HTMLButtonElement;
	customizeKeyBtn.textContent = 'Customize view';
	const keyPropsList = append(keySection, $('div.db-record-key-props'));
	const propertyRowByFieldId = new Map<string, HTMLElement>();
	const getDisplayedHeaderFields = () => {
		const selected = headerFieldIds
			.map(fieldId => propertyFields.find(field => field.id === fieldId))
			.filter((field): field is Field => Boolean(field));
		if (selected.length) {
			return selected.slice(0, 5);
		}
		return keyFields;
	};
	const persistHeaderFields = () => {
		void callbacks.onUpdateHeaderFields?.([...headerFieldIds]);
	};
	const renderKeyProperties = () => {
		clearNode(keyPropsList);
		for (const field of getDisplayedHeaderFields()) {
			const item = append(keyPropsList, $('button.db-record-key-prop')) as HTMLButtonElement;
			item.type = 'button';
			const label = append(item, $('span.db-record-key-label'));
			label.textContent = field.name;
			const value = append(item, $('span.db-record-key-value'));
			renderSummaryFieldValue(value, field, working, db, resolveDatabase);
			item.addEventListener('click', () => {
				propertyRowByFieldId.get(field.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				});
			}
		};
	customizeKeyBtn.addEventListener('click', event => {
		event.stopPropagation();
		showInlineDropdownPanel(customizeKeyBtn, 'db-record-header-fields-panel', panel => {
			const sectionTitle = append(panel, $('div.db-record-header-fields-title'));
			sectionTitle.textContent = 'Pin properties to header';
			const hint = append(panel, $('div.db-record-header-fields-hint'));
			hint.textContent = 'Choose up to 5 properties and drag to reorder.';
			const list = append(panel, $('div.db-record-header-fields-list'));

			let dragFieldId: string | null = null;

			const renderPicker = () => {
				clearNode(list);
				const selected = new Set(
					(headerFieldIds.length ? headerFieldIds : getDisplayedHeaderFields().map(field => field.id)),
				);
				for (const fieldId of headerPickerOrder) {
					const field = propertyFields.find(candidate => candidate.id === fieldId);
					if (!field) {
						continue;
					}
					const row = append(list, $('label.db-record-header-field-row')) as HTMLLabelElement;
					row.draggable = true;
					const handle = append(row, $('span.db-record-header-field-handle'));
					handle.textContent = '⋮⋮';
					const check = append(row, $('input')) as HTMLInputElement;
					check.type = 'checkbox';
					check.checked = selected.has(field.id);
					check.disabled = !check.checked && selected.size >= 5;
					const label = append(row, $('span.db-record-header-field-name'));
					label.textContent = field.name;

					check.addEventListener('change', () => {
						if (check.checked) {
							selected.add(field.id);
						} else {
							selected.delete(field.id);
						}
						headerFieldIds = headerPickerOrder.filter(id => selected.has(id)).slice(0, 5);
						renderKeyProperties();
						persistHeaderFields();
						renderPicker();
					});

					row.addEventListener('dragstart', () => {
						dragFieldId = field.id;
						row.classList.add('db-fields-row--dragging');
					});
					row.addEventListener('dragend', () => {
						dragFieldId = null;
						row.classList.remove('db-fields-row--dragging');
					});
					row.addEventListener('dragover', dragEvent => {
						dragEvent.preventDefault();
						row.classList.add('db-fields-row--over');
					});
					row.addEventListener('dragleave', () => row.classList.remove('db-fields-row--over'));
					row.addEventListener('drop', dropEvent => {
						dropEvent.preventDefault();
						row.classList.remove('db-fields-row--over');
						if (!dragFieldId || dragFieldId === field.id) {
							return;
						}
						const from = headerPickerOrder.indexOf(dragFieldId);
						const to = headerPickerOrder.indexOf(field.id);
						if (from < 0 || to < 0) {
							return;
						}
						const [moved] = headerPickerOrder.splice(from, 1);
						headerPickerOrder.splice(to, 0, moved);
						headerFieldIds = headerPickerOrder.filter(id => selected.has(id)).slice(0, 5);
						renderKeyProperties();
						persistHeaderFields();
						renderPicker();
					});
				}
			};

			renderPicker();

			const actions = append(panel, $('div.db-panel-add'));
			const resetBtn = append(actions, $('button.db-btn')) as HTMLButtonElement;
			resetBtn.textContent = 'Reset to suggested';
			resetBtn.addEventListener('click', () => {
				headerFieldIds = [];
				headerPickerOrder = [
					...propertyFields.map(field => field.id),
				];
				renderKeyProperties();
				persistHeaderFields();
				renderPicker();
			});
		});
	});

	if (!keyFields.length && !headerFieldIds.length) {
		keySection.style.display = 'none';
	} else {
		renderKeyProperties();
	}

	const taskSection = append(body, $('section.db-record-section'));
	append(taskSection, $('h4.db-record-section-title')).textContent = 'Tasks';
	renderRelatedTasksSection(taskSection, working, db, callbacks, resolveDatabase, () => {
		markDirty();
		renderMetaRow(meta, db, working);
		renderKeyProperties();
		if (titleField) {
			titleInput.value = getRecordTitle(working, db.schema);
		}
	});

	const propertiesSection = append(body, $('section.db-record-section'));
	const propertiesDetails = append(propertiesSection, $('details.db-record-properties-details')) as HTMLDetailsElement;
	propertiesDetails.open = false;
	const propertiesSummary = append(propertiesDetails, $('summary.db-record-properties-summary'));
	propertiesSummary.textContent = `Properties (${propertyFields.length})`;
	const propertiesList = append(propertiesDetails, $('div.db-record-prop-list'));

	for (const field of propertyFields) {
		const row = append(propertiesList, $('div.db-record-prop-row'));
		propertyRowByFieldId.set(field.id, row);
		append(row, $('div.db-record-prop-label')).textContent = field.name;
		const valueCell = append(row, $('div.db-record-prop-value'));
		renderPropertyEditor(valueCell, field, working, db, callbacks, resolveDatabase, () => {
			markDirty();
			renderMetaRow(meta, db, working);
			renderKeyProperties();
			if (titleField) {
				titleInput.value = getRecordTitle(working, db.schema);
			}
		});
	}

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
		markDirty();
		updateWordCount();
	});
	addNotesToolbar(toolbar, notes);
	updateWordCount();

	const footer = append(panel, $('div.db-record-footer'));
	const deleteBtn = append(footer, $('button.db-btn.db-btn-danger'));
	deleteBtn.textContent = 'Delete';
	deleteBtn.addEventListener('click', () => {
		if (confirm('Delete this record?')) {
			isDeleting = true;
			callbacks.onDelete(working);
			close();
		}
	});
	append(footer, $('span.db-toolbar-spacer'));
	const autosaveNote = append(footer, $('span.db-record-footer-note'));
	autosaveNote.textContent = 'Changes save automatically';

	panel.addEventListener('keydown', (event: KeyboardEvent) => {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			close();
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

	function close(): void {
		persistIfNeeded();
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
		renderSingleChipPicker(container, value && typeof value === 'string' ? value : null, options, field.type === 'status', nextValue => {
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
			groupStatus: false,
			showSearch: true,
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
	groupStatus: boolean,
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
			groupStatus,
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
			groupStatus: false,
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
		groupStatus?: boolean;
		showSearch?: boolean;
		onChange: (selected: string[]) => void;
	},
): void {
	document.querySelector('.db-record-picker-panel')?.remove();

	const panel = document.createElement('div');
	panel.className = 'db-dropdown-panel db-record-picker-panel';
	document.body.appendChild(panel);

	const showSearch = Boolean(options.showSearch);
	const search = showSearch ? append(panel, $('input.db-input')) as HTMLInputElement : undefined;
	if (search) {
		search.placeholder = 'Search options...';
	}
	const selectedRow = append(panel, $('div.db-record-picker-selected'));
	const list = append(panel, $('div.db-record-picker-list'));

	const selected = new Set(options.selected);

	const getStatusSection = (label: string): 'To-do' | 'In progress' | 'Complete' => {
		const normalized = label.trim().toLowerCase();
		if (normalized.includes('done') || normalized.includes('complete')) {
			return 'Complete';
		}
		if (normalized.includes('progress') || normalized.includes('active') || normalized.includes('doing') || normalized.includes('diagnostic')) {
			return 'In progress';
		}
		return 'To-do';
	};

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
			const remove = append(chipLabel, $('span.db-record-picker-selected-chip-remove'));
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
		const query = search?.value.trim().toLowerCase() ?? '';
		const filtered = options.options.filter(option => option.label.toLowerCase().includes(query));
		if (!filtered.length) {
			const empty = append(list, $('div.db-panel-empty'));
			empty.textContent = 'No matches';
			return;
		}

		const grouped = new Map<string, PickerOption[]>();
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

	search?.addEventListener('input', renderList);

	if (options.multi || selected.size) {
		const actions = append(panel, $('div.db-panel-add'));
		const clearBtn = append(actions, $('button.db-btn'));
		clearBtn.textContent = 'Clear';
		clearBtn.addEventListener('click', () => {
			selected.clear();
			options.onChange([]);
			renderSelected();
			renderList();
		});
		if (options.multi) {
			const doneBtn = append(actions, $('button.db-btn.db-btn-primary'));
			doneBtn.textContent = 'Done';
			doneBtn.addEventListener('click', close);
		}
	}

	const rect = anchor.getBoundingClientRect();
	panel.style.top = `${rect.bottom + 4}px`;
	panel.style.left = `${rect.left}px`;
	if (search) {
		search.focus();
	}
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
		const actions = append(head, $('div.db-related-tasks-actions'));
		const addBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		addBtn.textContent = '+ Task';
		const linkBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		linkBtn.textContent = 'Link existing';
		const filterBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		filterBtn.textContent = 'Filter';
		const sortBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		sortBtn.textContent = 'Sort';
		const fieldsBtn = append(actions, $('button.db-btn.db-record-editor-btn')) as HTMLButtonElement;
		fieldsBtn.textContent = 'Fields';

		const tableWrap = append(card, $('div.db-related-tasks-table-wrap'));
		const inlineCreate = append(card, $('div.db-related-task-inline-create'));
		inlineCreate.style.display = 'none';
		const inlineInput = append(inlineCreate, $('input.db-input')) as HTMLInputElement;
		inlineInput.placeholder = 'Task title';
		const inlineActions = append(inlineCreate, $('div.db-related-task-inline-actions'));
		const inlineCreateBtn = append(inlineActions, $('button.db-btn.db-btn-primary')) as HTMLButtonElement;
		inlineCreateBtn.textContent = 'Create';
		const targetDb = getRelationTargetDatabase(db, relationField, resolveDatabase);
		const titleField = targetDb.schema.find(field => field.type === 'text') ?? targetDb.schema[0];
		const defaultFieldOrder = [
			titleField?.id,
			targetDb.schema.find(field => field.type === 'status')?.id,
			targetDb.schema.find(field => field.type === 'select')?.id,
			targetDb.schema.find(field => field.type === 'date' && /due|start/i.test(field.name))?.id,
			targetDb.schema.find(field => field.type === 'date')?.id,
			targetDb.schema.find(field => field.type === 'relation')?.id,
			...targetDb.schema.map(field => field.id),
		].filter((fieldId, index, all): fieldId is string => Boolean(fieldId) && all.indexOf(fieldId) === index);
		const hiddenFieldIds = new Set<string>();
		let sortFieldId = '';
		let sortDirection: 'asc' | 'desc' = 'asc';
		let filterFieldId = '';
		let filterValue = '';

		const getLinkedRecords = () => {
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
			return [...linkedIds]
				.map(linkedId => targetDb.records.find(record => record.id === linkedId))
				.filter((record): record is DBRecord => Boolean(record));
		};

		const valueAsText = (value: string | number | boolean | string[] | null | undefined): string => {
			if (Array.isArray(value)) {
				return value.join(', ');
			}
			if (typeof value === 'boolean') {
				return value ? 'true' : 'false';
			}
			return value == null ? '' : String(value);
		};

			const renderTable = () => {
				clearNode(tableWrap);
				const visibleFields = defaultFieldOrder
					.map(fieldId => targetDb.schema.find(field => field.id === fieldId))
					.filter((field): field is Field => Boolean(field))
					.filter(field => !hiddenFieldIds.has(field.id))
					.filter(field => field.type !== 'createdAt' && field.type !== 'lastEditedAt' && field.type !== 'formula' && field.type !== 'rollup');

			const records = getLinkedRecords()
				.filter(record => {
					if (!filterFieldId || !filterValue) {
						return true;
					}
					const fieldValue = record[filterFieldId];
					if (Array.isArray(fieldValue)) {
						return fieldValue.includes(filterValue);
					}
					return fieldValue === filterValue;
				})
				.sort((left, right) => {
					if (!sortFieldId) {
						return 0;
					}
					const leftValue = valueAsText(left[sortFieldId]).toLowerCase();
					const rightValue = valueAsText(right[sortFieldId]).toLowerCase();
					const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
					return sortDirection === 'asc' ? comparison : -comparison;
				});

			filterBtn.classList.toggle('db-btn-active', Boolean(filterFieldId && filterValue));
			sortBtn.classList.toggle('db-btn-active', Boolean(sortFieldId));
			fieldsBtn.classList.toggle('db-btn-active', hiddenFieldIds.size > 0);

			if (!records.length) {
				const empty = append(tableWrap, $('div.db-record-auto-value'));
				empty.textContent = 'No related tasks';
				return;
			}

			const table = append(tableWrap, $('table.db-related-tasks-table')) as HTMLTableElement;
			const thead = append(table, $('thead'));
			const headerRow = append(thead, $('tr'));
			for (const field of visibleFields) {
				const th = append(headerRow, $('th'));
				th.textContent = field.name;
			}

			const tbody = append(table, $('tbody'));
			for (const taskRecord of records) {
				const row = append(tbody, $('tr.db-related-task-table-row'));
				if (callbacks.onOpenRelatedRecord) {
					row.addEventListener('click', event => {
						const mouse = event as MouseEvent;
						void callbacks.onOpenRelatedRecord?.(targetDb.id, taskRecord.id, {
							newTab: Boolean(mouse.metaKey || mouse.ctrlKey),
						});
					});
				}
				for (const field of visibleFields) {
					const td = append(row, $('td'));
					const value = taskRecord[field.id];
					if ((field.type === 'status' || field.type === 'select') && callbacks.onUpdateRelatedRecord) {
						const button = append(td, $('button.db-related-task-pill-btn')) as HTMLButtonElement;
						button.type = 'button';
						button.addEventListener('click', event => {
							event.preventDefault();
							event.stopPropagation();
							const options = (field.type === 'status' ? (field.options ?? STATUS_OPTIONS) : (field.options ?? []))
								.map(option => ({
									id: option,
									label: option,
									color: field.type === 'status' ? getStatusColor(option) : getFieldOptionColor(field, option),
								}));
							showOptionPicker(button, {
								multi: false,
								options,
								selected: typeof value === 'string' && value ? [value] : [],
								groupStatus: field.type === 'status',
								onChange: selected => {
									const nextValue = selected[0] ?? null;
									taskRecord[field.id] = nextValue;
									void callbacks.onUpdateRelatedRecord?.(targetDb.id, taskRecord.id, field.id, nextValue);
									renderTable();
								},
							});
						});
						if (typeof value === 'string' && value) {
							const pill = append(button, $('span.db-select-badge'));
							pill.textContent = value;
							const bg = field.type === 'status' ? getStatusColor(value) : getFieldOptionColor(field, value);
							pill.style.backgroundColor = bg;
							pill.style.color = getReadableTextColor(bg);
						} else {
							const empty = append(button, $('span.db-select-badge.db-select-badge--empty'));
							empty.textContent = 'Set';
						}
						continue;
					}

					if (field.type === 'multiselect' && Array.isArray(value) && value.length) {
						for (const option of value) {
							const pill = append(td, $('span.db-select-badge'));
							pill.textContent = option;
							const bg = getFieldOptionColor(field, option);
							pill.style.backgroundColor = bg;
							pill.style.color = getReadableTextColor(bg);
						}
						continue;
					}

					if (field.type === 'relation' && Array.isArray(value)) {
						const relationText = append(td, $('span.db-related-task-cell-text'));
						relationText.textContent = value.length ? `${value.length} linked` : '—';
						continue;
					}

					if (field.type === 'checkbox') {
						const checkbox = append(td, $('span.db-related-task-cell-text'));
						checkbox.textContent = value ? '✓' : '—';
						continue;
					}

					if (field.id === titleField?.id) {
						const title = append(td, $('span.db-related-task-cell-title'));
						title.textContent = getRecordTitle(taskRecord, targetDb.schema);
						continue;
					}

					const text = append(td, $('span.db-related-task-cell-text'));
					text.textContent = valueAsText(value) || '—';
				}
			}
		};

		addBtn.addEventListener('click', () => {
			inlineCreate.style.display = '';
			inlineInput.focus();
			inlineInput.select();
		});

		linkBtn.addEventListener('click', event => {
			event.stopPropagation();
			const candidates = targetDb.records
				.filter(candidate => candidate.id !== working.id)
				.map(candidate => ({ id: candidate.id, label: getRecordTitle(candidate, targetDb.schema) }));
			showOptionPicker(linkBtn, {
				multi: true,
				options: candidates,
				selected: Array.isArray(working[relationField.id]) ? [...working[relationField.id] as string[]] : [],
				showSearch: true,
				onChange: selected => {
					working[relationField.id] = selected;
					onChanged();
					renderTable();
				},
			});
		});

		filterBtn.addEventListener('click', event => {
			event.stopPropagation();
			const filterableFields = targetDb.schema.filter(field => field.type === 'status' || field.type === 'select');
			if (!filterableFields.length) {
				return;
			}
			showInlineDropdownPanel(filterBtn, 'db-related-tasks-filter-panel', (panel, close) => {
				const fieldSelect = append(panel, $('select.db-select')) as HTMLSelectElement;
				append(fieldSelect, $('option', { value: '' }, 'No filter'));
				for (const field of filterableFields) {
					const option = append(fieldSelect, $('option', { value: field.id })) as HTMLOptionElement;
					option.textContent = field.name;
					if (filterFieldId === field.id) {
						option.selected = true;
					}
				}

				const valueSelect = append(panel, $('select.db-select')) as HTMLSelectElement;
				const renderValueOptions = () => {
					clearNode(valueSelect);
					append(valueSelect, $('option', { value: '' }, 'All values'));
					const selectedField = filterableFields.find(field => field.id === fieldSelect.value);
					for (const optionValue of selectedField?.options ?? []) {
						const option = append(valueSelect, $('option', { value: optionValue })) as HTMLOptionElement;
						option.textContent = optionValue;
						if (filterValue === optionValue) {
							option.selected = true;
						}
					}
				};
				renderValueOptions();

				fieldSelect.addEventListener('change', () => {
					filterFieldId = fieldSelect.value;
					filterValue = '';
					renderValueOptions();
					renderTable();
				});
				valueSelect.addEventListener('change', () => {
					filterValue = valueSelect.value;
					renderTable();
					if (!filterValue) {
						close();
					}
				});
			});
		});

		sortBtn.addEventListener('click', event => {
			event.stopPropagation();
			showInlineDropdownPanel(sortBtn, 'db-related-tasks-sort-panel', panel => {
				const fieldSelect = append(panel, $('select.db-select')) as HTMLSelectElement;
				append(fieldSelect, $('option', { value: '' }, 'No sorting'));
				for (const field of targetDb.schema) {
					if (field.type === 'createdAt' || field.type === 'lastEditedAt' || field.type === 'formula' || field.type === 'rollup') {
						continue;
					}
					const option = append(fieldSelect, $('option', { value: field.id })) as HTMLOptionElement;
					option.textContent = field.name;
					if (sortFieldId === field.id) {
						option.selected = true;
					}
				}
				const directionBtn = append(panel, $('button.db-btn')) as HTMLButtonElement;
				directionBtn.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
				directionBtn.addEventListener('click', () => {
					sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
					directionBtn.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
					renderTable();
				});
				fieldSelect.addEventListener('change', () => {
					sortFieldId = fieldSelect.value;
					renderTable();
				});
			});
		});

		fieldsBtn.addEventListener('click', event => {
			event.stopPropagation();
			showInlineDropdownPanel(fieldsBtn, 'db-related-tasks-fields-panel', panel => {
				for (const fieldId of defaultFieldOrder) {
					const field = targetDb.schema.find(candidate => candidate.id === fieldId);
					if (!field || field.type === 'createdAt' || field.type === 'lastEditedAt' || field.type === 'formula' || field.type === 'rollup') {
						continue;
					}
					const row = append(panel, $('label.db-fields-row'));
					const check = append(row, $('input')) as HTMLInputElement;
					check.type = 'checkbox';
					check.checked = !hiddenFieldIds.has(field.id);
					const label = append(row, $('span.db-fields-name'));
					label.textContent = field.name;
					check.addEventListener('change', () => {
						if (check.checked) {
							hiddenFieldIds.delete(field.id);
						} else {
							hiddenFieldIds.add(field.id);
						}
						renderTable();
					});
				}
			});
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
				renderTable();
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

		renderTable();
	}
}

function getKeyPropertyFields(fields: Field[], resolveDatabase: DatabaseResolver | undefined, sourceDb: Database): Field[] {
	const scored = fields
		.filter(field => field.type !== 'createdAt' && field.type !== 'lastEditedAt' && field.type !== 'formula' && field.type !== 'rollup')
		.map(field => {
			let score = 0;
			if (field.type === 'status') { score += 60; }
			if (field.type === 'select') { score += 40; }
			if (field.type === 'date') { score += 35; }
			if (field.type === 'relation') { score += 28; }
			if (field.type === 'number') { score += 20; }
			if (field.type === 'checkbox') { score += 12; }
			if (/status|stage|priority|bucket|owner|domain|due|start|client|project|task/i.test(field.name)) { score += 18; }
			if (field.type === 'relation' && isTaskRelation(field, resolveDatabase, sourceDb)) { score -= 30; }
			return { field, score };
		})
		.sort((left, right) => right.score - left.score);
	return scored.map(entry => entry.field);
}

function renderSummaryFieldValue(
	container: HTMLElement,
	field: Field,
	record: DBRecord,
	db: Database,
	resolveDatabase: DatabaseResolver | undefined,
): void {
	clearNode(container);
	const value = getFieldValue(record, field, db, resolveDatabase);
	if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
		container.textContent = '—';
		return;
	}

	if ((field.type === 'status' || field.type === 'select') && typeof value === 'string') {
		const badge = append(container, $('span.db-select-badge'));
		badge.textContent = value;
		const bg = field.type === 'status' ? getStatusColor(value) : getFieldOptionColor(field, value);
		badge.style.backgroundColor = bg;
		badge.style.color = getReadableTextColor(bg);
		return;
	}

	if (field.type === 'multiselect' && Array.isArray(value)) {
		for (const entry of value.slice(0, 2)) {
			const badge = append(container, $('span.db-select-badge'));
			badge.textContent = entry;
			const bg = getFieldOptionColor(field, entry);
			badge.style.backgroundColor = bg;
			badge.style.color = getReadableTextColor(bg);
		}
		if (value.length > 2) {
			const more = append(container, $('span.db-record-summary-more'));
			more.textContent = `+${value.length - 2}`;
		}
		return;
	}

	if (field.type === 'relation' && Array.isArray(value)) {
		const targetDb = getRelationTargetDatabase(db, field, resolveDatabase);
		const names = value
			.slice(0, 2)
			.map(recordId => targetDb.records.find(candidate => candidate.id === recordId))
			.filter((candidate): candidate is DBRecord => Boolean(candidate))
			.map(candidate => getRecordTitle(candidate, targetDb.schema));
		container.textContent = names.length ? names.join(', ') : `${value.length} linked`;
		if (value.length > 2) {
			container.textContent += ` +${value.length - 2}`;
		}
		return;
	}

	if (field.type === 'checkbox') {
		container.textContent = value ? 'Yes' : 'No';
		return;
	}

	container.textContent = Array.isArray(value) ? value.join(', ') : String(value);
}

function showInlineDropdownPanel(
	anchor: HTMLElement,
	panelClassName: string,
	render: (panel: HTMLElement, close: () => void) => void,
): void {
	document.querySelector(`.${panelClassName}`)?.remove();
	const panel = document.createElement('div');
	panel.className = `db-dropdown-panel ${panelClassName}`;
	document.body.appendChild(panel);

	const close = () => panel.remove();
	render(panel, close);

	const rect = anchor.getBoundingClientRect();
	const margin = 8;
	let left = rect.left;
	let top = rect.bottom + 4;
	const panelRect = panel.getBoundingClientRect();
	const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
	left = Math.min(Math.max(margin, left), maxLeft);
	const wouldOverflowBottom = top + panelRect.height > window.innerHeight - margin;
	if (wouldOverflowBottom) {
		top = Math.max(margin, rect.top - panelRect.height - 4);
	}
	panel.style.top = `${top}px`;
	panel.style.left = `${left}px`;

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

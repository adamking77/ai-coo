/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let injected = false;

export function injectDatabaseStyles(): void {
	if (injected) { return; }
	injected = true;

	const style = document.createElement('style');
	style.id = 'genz-database-styles';
	style.textContent = CSS;
	document.head.appendChild(style);
}

const CSS = `
/* ─── Layout ─────────────────────────────────────────────────── */
.db-container {
	display: flex;
	height: 100%;
	overflow: hidden;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	font-size: var(--vscode-font-size);
	color: var(--vscode-foreground);
	color-scheme: var(--vscode-color-scheme, normal);
	--db-fg: var(--vscode-foreground, var(--vscode-editor-foreground, #cccccc));
	--db-bg: var(--vscode-editor-background, #1e1e1e);
	--db-border: var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
	--db-control-bg: var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background, #2a2d2e));
	--db-control-fg: var(--vscode-button-secondaryForeground, var(--vscode-foreground, #cccccc));
	--db-control-hover-bg: var(--vscode-button-secondaryHoverBackground, var(--vscode-toolbar-hoverBackground, #32363a));
	--db-primary-bg: var(--vscode-button-background, var(--vscode-focusBorder, #0e639c));
	--db-primary-fg: var(--vscode-button-foreground, #ffffff);
	--db-primary-hover-bg: var(--vscode-button-hoverBackground, var(--vscode-focusBorder, #1177bb));
	--db-tab-bg: var(--vscode-tab-inactiveBackground, transparent);
	--db-tab-fg: var(--vscode-tab-inactiveForeground, var(--vscode-foreground, #cccccc));
	--db-tab-active-bg: var(--vscode-tab-activeBackground, var(--vscode-editor-background, #1e1e1e));
	--db-tab-active-fg: var(--vscode-tab-activeForeground, var(--vscode-foreground, #ffffff));
}
.db-editor-root {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	font-size: var(--vscode-font-size);
	color: var(--vscode-foreground);
	background: var(--vscode-editor-background);
	color-scheme: var(--vscode-color-scheme, normal);
	--db-fg: var(--vscode-foreground, var(--vscode-editor-foreground, #cccccc));
	--db-bg: var(--vscode-editor-background, #1e1e1e);
	--db-border: var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
	--db-control-bg: var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background, #2a2d2e));
	--db-control-fg: var(--vscode-button-secondaryForeground, var(--vscode-foreground, #cccccc));
	--db-control-hover-bg: var(--vscode-button-secondaryHoverBackground, var(--vscode-toolbar-hoverBackground, #32363a));
	--db-primary-bg: var(--vscode-button-background, var(--vscode-focusBorder, #0e639c));
	--db-primary-fg: var(--vscode-button-foreground, #ffffff);
	--db-primary-hover-bg: var(--vscode-button-hoverBackground, var(--vscode-focusBorder, #1177bb));
	--db-tab-bg: var(--vscode-tab-inactiveBackground, transparent);
	--db-tab-fg: var(--vscode-tab-inactiveForeground, var(--vscode-foreground, #cccccc));
	--db-tab-active-bg: var(--vscode-tab-activeBackground, var(--vscode-editor-background, #1e1e1e));
	--db-tab-active-fg: var(--vscode-tab-activeForeground, var(--vscode-foreground, #ffffff));
}
.db-editor-content {
	flex: 1;
	overflow: auto;
}

/* ─── Left Panel ─────────────────────────────────────────────── */
.db-left {
	display: flex;
	flex-direction: column;
	min-width: 160px;
	border-right: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border));
	background: var(--vscode-sideBar-background);
	overflow: hidden;
}
.db-left-header {
	display: flex;
	align-items: center;
	padding: 6px 10px;
	border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border));
}
.db-left-title {
	flex: 1;
	font-weight: 600;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--vscode-sideBarSectionHeader-foreground);
}
.db-left-actions { display: flex; gap: 2px; }
.db-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.db-list-empty {
	padding: 12px 10px;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
}
.db-list-item {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 5px 10px;
	cursor: pointer;
	border-radius: 0;
}
.db-list-item:hover { background: var(--vscode-list-hoverBackground); }
.db-list-item--active {
	background: var(--vscode-list-activeSelectionBackground);
	color: var(--vscode-list-activeSelectionForeground);
}
.db-list-icon {
	font-size: 14px;
	color: var(--vscode-descriptionForeground);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
}
.db-list-item--active .db-list-icon {
	color: var(--vscode-list-activeSelectionForeground);
}
.db-list-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-list-count {
	font-size: 10px;
	padding: 1px 5px;
	border-radius: 8px;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}

/* ─── Right Panel ────────────────────────────────────────────── */
.db-right {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: var(--vscode-editor-background);
	position: relative;
}
.db-toolbar {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border));
	background: var(--vscode-editorGroupHeader-tabsBackground);
}
.db-toolbar-spacer { flex: 1; }
.db-content { flex: 1; overflow: auto; }
.db-empty-state {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--vscode-descriptionForeground);
}

/* ─── View Tabs ──────────────────────────────────────────────── */
.db-tabs { display: flex; gap: 2px; }
.db-tab {
	padding: 3px 10px;
	border: 1px solid transparent;
	border-radius: 3px;
	background: var(--db-tab-bg) !important;
	background-color: var(--db-tab-bg) !important;
	color: var(--db-tab-fg) !important;
	-webkit-text-fill-color: var(--db-tab-fg) !important;
	cursor: pointer;
	font-size: 12px;
	appearance: none;
	-webkit-appearance: none;
}
.db-tab:hover { background: var(--vscode-toolbar-hoverBackground); }
.db-tab--active {
	background: var(--db-tab-active-bg) !important;
	background-color: var(--db-tab-active-bg) !important;
	border-color: var(--vscode-focusBorder);
	color: var(--db-tab-active-fg) !important;
	-webkit-text-fill-color: var(--db-tab-active-fg) !important;
}

/* ─── Buttons ────────────────────────────────────────────────── */
.db-btn {
	padding: 3px 10px;
	border: 1px solid var(--vscode-button-border, var(--db-border));
	border-radius: 2px;
	background: var(--db-control-bg) !important;
	background-color: var(--db-control-bg) !important;
	color: var(--db-control-fg) !important;
	-webkit-text-fill-color: var(--db-control-fg) !important;
	cursor: pointer;
	font-size: 12px;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	appearance: none;
	-webkit-appearance: none;
}
.db-btn:hover { background: var(--db-control-hover-bg) !important; background-color: var(--db-control-hover-bg) !important; }
.db-btn-primary {
	background: var(--db-primary-bg) !important;
	background-color: var(--db-primary-bg) !important;
	color: var(--db-primary-fg) !important;
	-webkit-text-fill-color: var(--db-primary-fg) !important;
	border-color: transparent;
}
.db-btn-primary:hover { background: var(--db-primary-hover-bg) !important; background-color: var(--db-primary-hover-bg) !important; }
.db-icon-btn {
	width: 22px; height: 22px;
	border: none;
	background: transparent;
	color: var(--vscode-foreground);
	cursor: pointer;
	border-radius: 3px;
	display: flex; align-items: center; justify-content: center;
	font-size: 14px;
	padding: 0;
}
.db-icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }

/* ─── Inputs ─────────────────────────────────────────────────── */
.db-input {
	background: var(--vscode-input-background);
	color: var(--vscode-input-foreground);
	border: 1px solid var(--vscode-input-border);
	border-radius: 2px;
	padding: 3px 6px;
	font-size: 12px;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	outline: none;
}
.db-input:focus { border-color: var(--vscode-focusBorder); }
.db-input-textarea { resize: vertical; width: 100%; box-sizing: border-box; }
.db-select {
	background: var(--vscode-dropdown-background, var(--db-control-bg)) !important;
	background-color: var(--vscode-dropdown-background, var(--db-control-bg)) !important;
	color: var(--vscode-dropdown-foreground, var(--db-control-fg)) !important;
	-webkit-text-fill-color: var(--vscode-dropdown-foreground, var(--db-control-fg)) !important;
	border: 1px solid var(--vscode-dropdown-border);
	border-radius: 2px;
	padding: 3px 6px;
	font-size: 12px;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
}
.db-select:focus {
	outline: 1px solid var(--vscode-focusBorder);
	outline-offset: 0;
}
.db-input:focus,
.db-cell-editor:focus {
	outline: 1px solid var(--vscode-focusBorder);
	outline-offset: 0;
}

/* Ensure native dropdown popups remain legible across themes */
.db-select option,
.db-cell-editor option,
.db-input option {
	background: var(--vscode-dropdown-listBackground, var(--vscode-editorWidget-background));
	color: var(--vscode-dropdown-listForeground, var(--vscode-foreground));
}
.db-select optgroup,
.db-cell-editor optgroup,
.db-input optgroup {
	background: var(--vscode-dropdown-listBackground, var(--vscode-editorWidget-background));
	color: var(--vscode-dropdown-listForeground, var(--vscode-foreground));
}

/* ─── Table ──────────────────────────────────────────────────── */
.db-table-wrapper { overflow: auto; height: 100%; }
.db-table {
	width: 100%;
	border-collapse: collapse;
	table-layout: auto;
}
.db-th {
	position: sticky;
	top: 0;
	background: var(--vscode-editorGroupHeader-tabsBackground);
	border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border));
	padding: 0 8px;
	height: 32px;
	text-align: left;
	font-size: 12px;
	font-weight: 500;
	white-space: nowrap;
	z-index: 1;
}
.db-th-label { flex: 1; }
.db-th-label-action { cursor: pointer; }
.db-th-label-action:hover { color: var(--vscode-textLink-foreground); text-decoration: underline; text-underline-offset: 2px; }
.db-th-check { width: 32px; }
.db-th-add { width: 100%; }
.db-row { cursor: pointer; }
.db-row:hover td { background: var(--vscode-list-hoverBackground); }
.db-td {
	padding: 4px 8px;
	height: 32px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
	font-size: 13px;
	max-width: 240px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.db-td-check { width: 32px; }
.db-td-end { width: 100%; }
.db-cell-display { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.db-cell-editor {
	width: 100%;
	min-width: 80px;
	box-sizing: border-box;
	background: var(--vscode-input-background, var(--db-control-bg)) !important;
	background-color: var(--vscode-input-background, var(--db-control-bg)) !important;
	color: var(--vscode-input-foreground, var(--db-control-fg)) !important;
	-webkit-text-fill-color: var(--vscode-input-foreground, var(--db-control-fg)) !important;
	border: 1px solid var(--vscode-focusBorder);
	border-radius: 2px;
	padding: 2px 4px;
	font-size: 13px;
	font-family: var(--vscode-font-family);
}
.db-cell-checkbox { cursor: pointer; }
.db-row-check { cursor: pointer; }
.db-add-row td { height: 32px; }
.db-add-record-btn {
	background: transparent;
	border: none;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	font-size: 12px;
	padding: 4px 8px;
}
.db-add-record-btn:hover { color: var(--vscode-foreground); }

/* ─── Select Badge ───────────────────────────────────────────── */
.db-select-badge {
	display: inline-block;
	padding: 1px 6px;
	border-radius: 10px;
	font-size: 11px;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
	margin-right: 3px;
}

/* ─── Select Property Editor ─────────────────────────────────── */
.db-property-editor-panel {
	min-width: 320px;
	max-width: 420px;
}
.db-property-menu-panel {
	min-width: 320px;
	max-width: 380px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.db-property-menu-name-row { display: flex; }
.db-property-menu-name-input { width: 100%; }
.db-property-menu-type-row {
	display: grid;
	grid-template-columns: 48px minmax(120px, 1fr);
	gap: 8px;
	align-items: center;
}
.db-property-menu-type-label {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	text-transform: uppercase;
}
.db-property-menu-type-select { width: 100%; }
.db-property-menu-options-wrap {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding-top: 4px;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
}
.db-property-menu-actions {
	display: flex;
	justify-content: flex-end;
	gap: 6px;
	padding-top: 6px;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
}
.db-property-option-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-height: 260px;
	overflow-y: auto;
	padding-right: 2px;
}
.db-property-option-row {
	display: grid;
	grid-template-columns: minmax(120px, 1fr) 94px 24px;
	align-items: center;
	gap: 6px;
}
.db-property-option-name { width: 100%; }
.db-property-color-btn {
	width: 100%;
	padding: 3px 6px;
	text-align: center;
	border-radius: 999px;
	border-color: transparent;
	font-weight: 600;
}
.db-property-color-menu { min-width: 110px; }
.db-property-color-item {
	display: flex;
	align-items: center;
}
.db-property-color-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 2px 10px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 600;
	min-width: 84px;
}
.db-property-color-item--active {
	background: var(--vscode-list-activeSelectionBackground);
	color: var(--vscode-list-activeSelectionForeground) !important;
}

/* ─── Kanban ─────────────────────────────────────────────────── */
.db-kanban-board {
	display: flex;
	gap: 16px;
	padding: 16px;
	height: 100%;
	box-sizing: border-box;
	overflow-x: auto;
	align-items: flex-start;
}
.db-kanban-col {
	min-width: 260px;
	max-width: 320px;
	background: var(--vscode-editorWidget-background);
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
	border-radius: 6px;
	display: flex;
	flex-direction: column;
	gap: 0;
}
.db-kanban-col--over { border-color: var(--vscode-focusBorder); }
.db-kanban-col-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px 8px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
}
.db-kanban-col-title { font-weight: 600; font-size: 12px; }
.db-kanban-cards { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.db-kanban-card {
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
	border-radius: 6px;
	padding: 10px 12px;
	cursor: pointer;
	transition: box-shadow 0.1s;
}
.db-kanban-card:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.db-kanban-card--dragging { opacity: 0.5; }
.db-kanban-card-title { font-size: 13px; font-weight: 500; margin-bottom: 8px; }
.db-kanban-card-field { font-size: 11px; line-height: 1.45; color: var(--vscode-descriptionForeground); margin-top: 6px; }
.db-kanban-add {
	margin: 8px 10px 10px;
	background: transparent;
	border: 1px dashed var(--vscode-widget-border, rgba(128,128,128,0.3));
	border-radius: 6px;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	padding: 8px;
	font-size: 12px;
	width: calc(100% - 20px);
}
.db-kanban-add:hover { border-color: var(--vscode-focusBorder); color: var(--vscode-foreground); }
.db-kanban-empty {
	padding: 20px;
	color: var(--vscode-descriptionForeground);
	font-size: 12px;
}

/* ─── Schema Editor ──────────────────────────────────────────── */
.db-schema-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0,0,0,0.4);
	display: flex;
	align-items: flex-start;
	justify-content: center;
	z-index: 100;
	padding-top: 40px;
}
.db-schema-panel {
	background: var(--vscode-editorWidget-background);
	border: 1px solid var(--vscode-widget-border);
	border-radius: 4px;
	width: 480px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.db-schema-header {
	display: flex;
	align-items: center;
	padding: 10px 14px;
	border-bottom: 1px solid var(--vscode-widget-border);
}
.db-schema-title { flex: 1; margin: 0; font-size: 14px; font-weight: 600; }
.db-schema-list { flex: 1; overflow-y: auto; padding: 8px; }
.db-schema-row {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 0;
}
.db-schema-name { flex: 2; }
.db-schema-type { flex: 1; }
.db-schema-options { flex: 2; }
.db-schema-delete { color: var(--vscode-errorForeground); }
.db-schema-add {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px solid var(--vscode-widget-border);
}
.db-schema-add-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
.db-schema-add-row { display: flex; gap: 6px; align-items: center; }
.db-schema-footer {
	display: flex;
	gap: 6px;
	padding: 10px 14px;
	border-top: 1px solid var(--vscode-widget-border);
	justify-content: flex-end;
}

/* ─── Record Editor ──────────────────────────────────────────── */
.db-record-panel {
	position: absolute;
	top: 0;
	right: 0;
	width: min(520px, 65vw);
	min-width: 420px;
	height: 100%;
	background: var(--vscode-editor-background);
	border-left: 1px solid var(--vscode-widget-border);
	display: flex;
	flex-direction: column;
	box-shadow: -8px 0 28px rgba(0,0,0,0.18);
	z-index: 50;
}
.db-record-panel--fullpage {
	position: relative;
	top: auto;
	right: auto;
	height: 100%;
	left: 0;
	width: 100% !important;
	min-width: 0;
	max-width: none;
	box-shadow: none;
	border-left: none;
}
.db-record-resize-handle {
	position: absolute;
	left: -3px;
	top: 0;
	width: 6px;
	height: 100%;
	cursor: ew-resize;
	z-index: 3;
	background: transparent;
}
.db-record-resize-handle:hover {
	background: var(--vscode-focusBorder);
}
.db-record-panel--fullpage .db-record-resize-handle {
	display: none;
}
.db-record-header {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	padding: 12px 14px 10px;
	border-bottom: 1px solid var(--vscode-widget-border);
	position: sticky;
	top: 0;
	background: var(--vscode-editor-background);
	z-index: 2;
}
.db-record-title-wrap {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}
.db-record-icon-btn {
	width: 28px;
	height: 28px;
	border: 1px solid var(--vscode-widget-border);
	border-radius: 5px;
	background: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
	cursor: pointer;
}
.db-record-title-input {
	flex: 1;
	min-width: 0;
	border: none;
	background: transparent;
	color: var(--vscode-foreground);
	font-size: 20px;
	font-weight: 600;
	line-height: 1.2;
	padding: 2px 0;
}
.db-record-title-input:focus {
	outline: none;
	border-bottom: 1px solid var(--vscode-focusBorder);
}
.db-record-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 8px 14px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.18));
	background: var(--vscode-editor-background);
	position: sticky;
	top: 54px;
	z-index: 1;
}
.db-record-meta-item {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	padding: 2px 6px;
	border-radius: 999px;
	background: var(--vscode-editorWidget-background);
}
.db-record-body {
	flex: 1;
	overflow-y: auto;
	padding: 14px;
}
.db-record-section { margin-bottom: 18px; }
.db-record-key-section { margin-bottom: 14px; }
.db-record-key-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 8px;
}
.db-record-key-config-btn {
	padding-inline: 10px;
}
.db-record-key-props {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.db-record-key-prop {
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
	background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-foreground) 8%);
	color: var(--vscode-foreground);
	border-radius: 8px;
	padding: 6px 10px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 120px;
	text-align: left;
	cursor: pointer;
}
.db-record-key-prop:hover {
	background: var(--vscode-list-hoverBackground);
}
.db-record-key-label {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}
.db-record-key-value {
	font-size: 12px;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px;
}
.db-record-summary-more {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}
.db-record-header-fields-hint {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	margin-bottom: 6px;
}
.db-record-header-fields-panel {
	min-width: 260px;
	max-width: 320px;
	background: var(--vscode-menu-background, var(--vscode-editorWidget-background, var(--vscode-editor-background))) !important;
	color: var(--vscode-menu-foreground, var(--vscode-foreground)) !important;
	border-color: var(--vscode-menu-border, var(--vscode-widget-border, rgba(128,128,128,0.3))) !important;
}
.db-record-header-fields-title {
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-menu-foreground, var(--vscode-foreground));
	margin-bottom: 6px;
}
.db-record-header-fields-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	max-height: 260px;
	overflow-y: auto;
}
.db-record-header-field-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 6px;
	border-radius: 4px;
	cursor: grab;
	border: 1px solid transparent;
}
.db-record-header-field-row:hover {
	background: var(--vscode-list-hoverBackground);
	border-color: var(--vscode-widget-border, rgba(128,128,128,0.18));
}
.db-record-header-field-row.db-fields-row--dragging {
	opacity: 0.4;
}
.db-record-header-field-handle {
	color: var(--vscode-descriptionForeground);
	font-size: 13px;
	letter-spacing: -1px;
}
.db-record-header-field-name {
	font-size: 12px;
	color: var(--vscode-menu-foreground, var(--vscode-foreground));
}
.db-record-section-title {
	margin: 0 0 8px;
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--vscode-descriptionForeground);
}
.db-record-prop-list {
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
	border-radius: 6px;
	overflow: hidden;
	background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-foreground) 6%);
}
.db-record-properties-details {
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
	border-radius: 8px;
	background: color-mix(in srgb, var(--vscode-editor-background) 97%, var(--vscode-foreground) 3%);
	overflow: hidden;
}
.db-record-properties-summary {
	cursor: pointer;
	padding: 8px 10px;
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-foreground);
	list-style: none;
}
.db-record-properties-summary::-webkit-details-marker {
	display: none;
}
.db-record-properties-summary::before {
	content: '▸';
	display: inline-block;
	margin-right: 6px;
	color: var(--vscode-descriptionForeground);
}
.db-record-properties-details[open] .db-record-properties-summary::before {
	content: '▾';
}
.db-record-properties-details .db-record-prop-list {
	border: none;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
	border-radius: 0;
}
.db-record-prop-row {
	display: grid;
	grid-template-columns: 140px minmax(0, 1fr);
	align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.07));
}
.db-record-prop-row:last-child { border-bottom: none; }
.db-record-prop-label {
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
}
.db-record-prop-value {
	min-width: 0;
	display: flex;
	align-items: center;
}
.db-relation-prop {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.db-relation-prop-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.db-relation-prop-row {
	display: flex;
	align-items: center;
	gap: 8px;
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
	border-radius: 6px;
	background: transparent;
	color: var(--vscode-foreground);
	padding: 4px 8px;
	cursor: pointer;
	text-align: left;
}
.db-relation-prop-row:hover {
	background: var(--vscode-list-hoverBackground);
}
.db-relation-prop-title {
	flex: 1;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.db-relation-prop-meta {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}
.db-relation-prop-actions {
	display: flex;
	gap: 6px;
}
.db-record-picker-trigger {
	min-width: 120px;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.db-record-chip-row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
}
.db-record-chip-list {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	flex: 1;
	min-width: 0;
}
.db-record-chip-list--clickable {
	cursor: pointer;
}
.db-record-chip-list--clickable:hover .db-select-badge {
	filter: brightness(1.06);
}
.db-select-badge--empty {
	background: var(--vscode-button-secondaryBackground) !important;
	color: var(--vscode-button-secondaryForeground) !important;
	border: 1px dashed var(--vscode-widget-border, rgba(128,128,128,0.25));
}
.db-field-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
.db-field-group .db-input { width: 100%; box-sizing: border-box; }
.db-input-check { width: 16px; height: 16px; cursor: pointer; }
.db-multiselect-group { display: flex; flex-wrap: wrap; gap: 6px; }
.db-multiselect-option { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; }
.db-record-notes {
	width: 100%;
	box-sizing: border-box;
	min-height: 220px;
	resize: vertical;
	border: none;
	outline: none;
	background: transparent;
	font-size: 14px;
	line-height: 1.6;
	padding: 10px 12px 12px;
}
.db-record-editor {
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.14));
	border-radius: 8px;
	background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-foreground) 4%);
	overflow: hidden;
}
.db-record-editor-toolbar {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
	padding: 8px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
	background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-foreground) 8%);
}
.db-record-editor-btn {
	padding: 2px 8px;
	font-size: 11px;
}
.db-record-editor-meta {
	display: flex;
	justify-content: flex-end;
	padding: 6px 10px;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
}
.db-record-editor-count {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}
.db-related-tasks {
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
	border-radius: 8px;
	overflow: hidden;
	margin-bottom: 10px;
}
.db-related-tasks-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 10px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
	background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-foreground) 6%);
}
.db-related-tasks-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
.db-related-tasks-title {
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-foreground);
}
.db-related-tasks-table-wrap {
	overflow-x: auto;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
}
.db-related-tasks-table {
	width: max(100%, 700px);
	border-collapse: collapse;
}
.db-related-tasks-table th,
.db-related-tasks-table td {
	padding: 7px 10px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
	font-size: 12px;
	white-space: nowrap;
	text-align: left;
}
.db-related-tasks-table th {
	position: sticky;
	top: 0;
	background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-foreground) 4%);
	color: var(--vscode-descriptionForeground);
	font-weight: 600;
	z-index: 1;
}
.db-related-task-table-row {
	cursor: pointer;
}
.db-related-task-table-row:hover td {
	background: var(--vscode-list-hoverBackground);
}
.db-related-task-cell-title {
	font-weight: 600;
	color: var(--vscode-foreground);
}
.db-related-task-cell-text {
	color: var(--vscode-foreground);
}
.db-related-task-pill-btn {
	background: transparent;
	border: none;
	padding: 0;
	cursor: pointer;
}
.db-related-task-pill-btn .db-select-badge {
	margin-right: 0;
}
.db-related-task-inline-create {
	padding: 8px;
	border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.06));
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.db-related-task-inline-actions {
	display: flex;
	justify-content: flex-end;
	gap: 6px;
}
.db-record-picker-panel {
	min-width: 260px;
	max-width: 340px;
}
.db-record-picker-selected {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 6px;
}
.db-record-picker-selected-chip {
	background: transparent;
	border: none;
	padding: 0;
	cursor: pointer;
}
.db-record-picker-selected-chip-label {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 12px;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}
.db-record-picker-selected-chip-remove {
	opacity: 0.85;
}
.db-record-picker-list {
	margin-top: 6px;
	max-height: 240px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.db-record-picker-section-title {
	margin-top: 8px;
	padding: 4px 6px 2px;
	font-size: 11px;
	font-weight: 600;
	color: var(--vscode-descriptionForeground);
	text-transform: uppercase;
	letter-spacing: 0.02em;
}
.db-record-picker-section-title:first-child {
	margin-top: 0;
}
.db-record-picker-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 4px 6px;
	border: none;
	background: transparent;
	color: var(--vscode-foreground);
	text-align: left;
	cursor: pointer;
	border-radius: 4px;
}
.db-record-picker-item:hover { background: var(--vscode-list-hoverBackground); }
.db-record-picker-mark { width: 12px; color: var(--vscode-descriptionForeground); text-align: right; }
.db-record-picker-label {
	font-size: 12px;
}
.db-record-picker-label--color {
	padding: 1px 6px;
	border-radius: 10px;
}
.db-record-footer {
	display: flex;
	gap: 6px;
	padding: 10px 14px;
	border-top: 1px solid var(--vscode-widget-border);
	justify-content: flex-end;
	background: var(--vscode-editor-background);
	position: sticky;
	bottom: 0;
	z-index: 2;
}
.db-record-footer-note {
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	align-self: center;
}

/* ─── New DB Form ────────────────────────────────────────────── */
.db-new-form { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.db-new-form .db-input { width: 100%; box-sizing: border-box; }
.db-new-form-btns { display: flex; gap: 4px; }

/* ─── Status Badge ───────────────────────────────────────────── */
.db-status-badge {
	display: inline-block;
	padding: 1px 8px;
	border-radius: 10px;
	font-size: 11px;
	color: var(--vscode-button-foreground, #ffffff);
	font-weight: 500;
}

/* ─── Column Resize Handle ───────────────────────────────────── */
.db-th { position: relative; }
.db-th-inner { display: flex; align-items: center; gap: 4px; }
.db-col-resize-handle {
	position: absolute;
	top: 0; right: 0;
	width: 4px;
	height: 100%;
	cursor: col-resize;
	background: transparent;
}
.db-col-resize-handle:hover { background: var(--vscode-focusBorder); }

/* ─── Row Hover Actions ──────────────────────────────────────── */
.db-row-actions-cell { width: 0; padding: 0 !important; overflow: visible; }
.db-row-actions {
	display: none;
	gap: 2px;
	position: absolute;
	right: 4px;
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
	border-radius: 3px;
	padding: 1px;
	z-index: 10;
}
.db-row:hover .db-row-actions { display: flex; }
.db-icon-btn-danger { color: var(--vscode-errorForeground) !important; }

/* ─── Add Field Button ───────────────────────────────────────── */
.db-th-add-field { width: 32px; }
.db-add-field-btn {
	width: 24px; height: 24px;
	border: 1px dashed var(--vscode-widget-border, rgba(128,128,128,0.4));
	background: transparent;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	border-radius: 3px;
	font-size: 14px;
	display: flex; align-items: center; justify-content: center;
}
.db-add-field-btn:hover {
	border-color: var(--vscode-focusBorder);
	color: var(--vscode-foreground);
}

/* ─── Multiselect Cell Editor ────────────────────────────────── */
.db-multiselect-editor {
	position: absolute;
	background: var(--vscode-editorWidget-background);
	border: 1px solid var(--vscode-widget-border);
	border-radius: 4px;
	padding: 6px;
	z-index: 20;
	min-width: 120px;
	box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.db-multiselect-row {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 3px 0;
	cursor: pointer;
	font-size: 12px;
}

/* ─── Group Rows ─────────────────────────────────────────────── */
.db-group-header-row td { background: var(--vscode-editorGroupHeader-tabsBackground); }
.db-group-header-cell {
	padding: 4px 8px;
	display: flex;
	align-items: center;
	gap: 6px;
}
.db-group-status-dot {
	width: 8px; height: 8px;
	border-radius: 50%;
	display: inline-block;
	flex-shrink: 0;
}
.db-group-label { font-size: 12px; font-weight: 600; }
.db-group-count {
	font-size: 10px;
	padding: 1px 5px;
	border-radius: 8px;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}

/* ─── Cell Link ──────────────────────────────────────────────── */
.db-cell-link { color: var(--vscode-textLink-foreground); text-decoration: none; }
.db-cell-link:hover { text-decoration: underline; }

/* ─── Add View Button ────────────────────────────────────────── */
.db-add-view-btn {
	padding: 3px 8px;
	border: 1px dashed var(--vscode-widget-border, rgba(128,128,128,0.3));
	border-radius: 3px;
	background: transparent;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	font-size: 12px;
}
.db-add-view-btn:hover { border-color: var(--vscode-focusBorder); color: var(--vscode-foreground); }

/* ─── Tab Wrapper + Close ────────────────────────────────────── */
.db-tab-wrapper { display: flex; align-items: center; gap: 1px; }
.db-tab-close {
	width: 16px; height: 16px;
	border: none;
	background: transparent;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	border-radius: 2px;
	font-size: 11px;
	display: none;
	align-items: center;
	justify-content: center;
	padding: 0;
}
.db-tab-wrapper:hover .db-tab-close { display: flex; }
.db-tab-close:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }

/* ─── Toolbar Active State ───────────────────────────────────── */
.db-btn-active {
	background: var(--vscode-button-background) !important;
	color: var(--vscode-button-foreground) !important;
}

/* ─── Dropdown Panels (Sort/Filter/Fields) ───────────────────── */
.db-dropdown-panel {
	position: fixed;
	background: var(--db-overlay-bg, var(--vscode-menu-background, var(--vscode-editorWidget-background, var(--vscode-editor-background, #ffffff)))) !important;
	background-color: var(--db-overlay-bg, var(--vscode-menu-background, var(--vscode-editorWidget-background, var(--vscode-editor-background, #ffffff)))) !important;
	color: var(--db-overlay-fg, var(--vscode-menu-foreground, var(--vscode-foreground, #1f1f1f))) !important;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	font-size: var(--vscode-font-size);
	line-height: 1.4;
	border: 1px solid var(--db-overlay-border, var(--vscode-menu-border, var(--vscode-widget-border, rgba(0, 0, 0, 0.16))));
	border-radius: 4px;
	min-width: 260px;
	max-width: 400px;
	box-shadow: 0 4px 16px rgba(0,0,0,0.25);
	z-index: 200;
	padding: 8px;
	color-scheme: var(--vscode-color-scheme, normal);
	backdrop-filter: none !important;
	-webkit-backdrop-filter: none !important;
}
.db-dropdown-panel * {
	font-family: inherit;
}
.db-dropdown-panel button,
.db-dropdown-panel input,
.db-dropdown-panel select,
.db-dropdown-panel textarea {
	font-family: inherit !important;
}
.db-panel-section-title {
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	color: var(--vscode-descriptionForeground);
	padding-bottom: 6px;
	margin-bottom: 4px;
	border-bottom: 1px solid var(--vscode-widget-border);
}
.db-panel-row {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 3px 0;
}
.db-dropdown-panel .db-select,
.db-dropdown-panel .db-input,
.db-dropdown-panel .db-cell-editor {
	background: var(--db-overlay-input-bg, var(--vscode-input-background, var(--vscode-editorWidget-background, #ffffff))) !important;
	background-color: var(--db-overlay-input-bg, var(--vscode-input-background, var(--vscode-editorWidget-background, #ffffff))) !important;
	color: var(--db-overlay-input-fg, var(--vscode-input-foreground, var(--vscode-foreground, #1f1f1f))) !important;
	-webkit-text-fill-color: var(--db-overlay-input-fg, var(--vscode-input-foreground, var(--vscode-foreground, #1f1f1f))) !important;
	border-color: var(--db-overlay-border, var(--vscode-input-border, var(--vscode-widget-border, rgba(0, 0, 0, 0.16)))) !important;
}
.db-dropdown-panel .db-select option,
.db-dropdown-panel .db-cell-editor option {
	background: var(--db-overlay-bg, var(--vscode-menu-background, var(--vscode-editorWidget-background, #ffffff))) !important;
	color: var(--db-overlay-fg, var(--vscode-menu-foreground, var(--vscode-foreground, #1f1f1f))) !important;
}
.db-panel-empty {
	padding: 8px 0;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
}
.db-panel-add { padding: 6px 0 2px; border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1)); margin-top: 4px; }

/* ─── Fields Picker ──────────────────────────────────────────── */
.db-fields-panel { min-width: 200px; }
.db-fields-list { max-height: 280px; overflow-y: auto; }
.db-fields-row {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 2px;
	border-radius: 3px;
}
.db-fields-row:hover { background: var(--vscode-list-hoverBackground); }
.db-fields-row--dragging { opacity: 0.4; }
.db-fields-row--over { border-top: 2px solid var(--vscode-focusBorder); }
.db-fields-handle { cursor: grab; color: var(--vscode-descriptionForeground); font-size: 14px; }
.db-fields-name { flex: 1; font-size: 12px; }

/* ─── Context Menu ───────────────────────────────────────────── */
.db-context-menu {
	position: fixed;
	background: var(--db-overlay-bg, var(--vscode-menu-background, var(--vscode-editorWidget-background, var(--vscode-editor-background, #ffffff)))) !important;
	background-color: var(--db-overlay-bg, var(--vscode-menu-background, var(--vscode-editorWidget-background, var(--vscode-editor-background, #ffffff)))) !important;
	color: var(--db-overlay-fg, var(--vscode-menu-foreground, var(--vscode-foreground, #1f1f1f))) !important;
	font-family: var(--vscode-font-family, var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
	font-size: var(--vscode-font-size);
	line-height: 1.4;
	border: 1px solid var(--db-overlay-border, var(--vscode-menu-border, var(--vscode-widget-border, rgba(0, 0, 0, 0.16))));
	border-radius: 4px;
	min-width: 140px;
	box-shadow: 0 4px 12px rgba(0,0,0,0.25);
	z-index: 300;
	padding: 4px 0;
	color-scheme: var(--vscode-color-scheme, normal);
	backdrop-filter: none !important;
	-webkit-backdrop-filter: none !important;
}
.db-context-menu * {
	font-family: inherit;
}
.db-context-menu button,
.db-context-menu input,
.db-context-menu select,
.db-context-menu textarea {
	font-family: inherit !important;
}
.db-context-menu-item {
	padding: 6px 12px;
	font-size: 12px;
	cursor: pointer;
	color: var(--db-overlay-fg, var(--vscode-menu-foreground, var(--vscode-foreground, #1f1f1f))) !important;
	-webkit-text-fill-color: var(--db-overlay-fg, var(--vscode-menu-foreground, var(--vscode-foreground, #1f1f1f))) !important;
}
.db-context-menu-item:hover { background: var(--vscode-list-hoverBackground); }
.db-context-menu-item--danger { color: var(--vscode-errorForeground); }

/* Enforce light/dark parity from workbench theme classes */
.monaco-workbench.vs .db-dropdown-panel,
.monaco-workbench.hc-light .db-dropdown-panel,
.monaco-workbench.vs .db-context-menu,
.monaco-workbench.hc-light .db-context-menu {
	background: var(--vscode-editor-background, #ffffff) !important;
	background-color: var(--vscode-editor-background, #ffffff) !important;
	color: var(--vscode-editor-foreground, #1f1f1f) !important;
	border-color: var(--vscode-widget-border, rgba(0, 0, 0, 0.2)) !important;
}

.monaco-workbench.vs .db-context-menu-item,
.monaco-workbench.hc-light .db-context-menu-item {
	color: var(--vscode-editor-foreground, #1f1f1f) !important;
	-webkit-text-fill-color: var(--vscode-editor-foreground, #1f1f1f) !important;
}

.monaco-workbench.vs .db-dropdown-panel .db-select,
.monaco-workbench.vs .db-dropdown-panel .db-input,
.monaco-workbench.vs .db-dropdown-panel .db-cell-editor,
.monaco-workbench.hc-light .db-dropdown-panel .db-select,
.monaco-workbench.hc-light .db-dropdown-panel .db-input,
.monaco-workbench.hc-light .db-dropdown-panel .db-cell-editor {
	background: var(--vscode-input-background, #ffffff) !important;
	background-color: var(--vscode-input-background, #ffffff) !important;
	color: var(--vscode-input-foreground, #1f1f1f) !important;
	-webkit-text-fill-color: var(--vscode-input-foreground, #1f1f1f) !important;
	border-color: var(--vscode-input-border, var(--vscode-widget-border, rgba(0, 0, 0, 0.2))) !important;
}

.monaco-workbench.vs .db-dropdown-panel .db-select option,
.monaco-workbench.vs .db-dropdown-panel .db-cell-editor option,
.monaco-workbench.hc-light .db-dropdown-panel .db-select option,
.monaco-workbench.hc-light .db-dropdown-panel .db-cell-editor option {
	background: var(--vscode-editor-background, #ffffff) !important;
	color: var(--vscode-editor-foreground, #1f1f1f) !important;
}

.monaco-workbench.vs-dark .db-dropdown-panel,
.monaco-workbench.hc-black .db-dropdown-panel,
.monaco-workbench.vs-dark .db-context-menu,
.monaco-workbench.hc-black .db-context-menu {
	background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e)) !important;
	background-color: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e)) !important;
	color: var(--vscode-editorWidget-foreground, var(--vscode-foreground, #cccccc)) !important;
	border-color: var(--vscode-widget-border, rgba(128, 128, 128, 0.35)) !important;
}

/* ─── Database List Additions ────────────────────────────────── */
.db-list-menu-btn {
	display: none;
	border: none;
	background: transparent;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
	padding: 1px 4px;
	border-radius: 2px;
	font-size: 13px;
}
.db-list-item:hover .db-list-menu-btn { display: block; }
.db-list-menu-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.db-list-menu-btn.codicon {
	font-size: 14px;
	padding: 1px 3px;
}
.db-list-rename-input { width: 100%; box-sizing: border-box; }
.db-tab-rename-input { width: 80px; box-sizing: border-box; }

/* ─── List View ──────────────────────────────────────────────── */
.db-list-view-wrapper { padding: 4px 0; }
.db-list-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 12px;
	cursor: pointer;
	position: relative;
}
.db-list-row:hover { background: var(--vscode-list-hoverBackground); }
.db-list-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.db-list-row-title { font-size: 13px; font-weight: 500; flex: 0 0 auto; min-width: 120px; }
.db-list-row-meta { font-size: 11px; color: var(--vscode-descriptionForeground); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-list-row-actions { display: none; gap: 2px; margin-left: auto; }
.db-list-row:hover .db-list-row-actions { display: flex; }
.db-list-add-row {
	padding: 6px 12px;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
}
.db-list-add-row:hover { color: var(--vscode-foreground); }

/* ─── Gallery View ───────────────────────────────────────────── */
.db-gallery-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 12px;
	padding: 12px;
}
.db-gallery-card {
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
	border-radius: 4px;
	overflow: hidden;
	cursor: pointer;
	transition: box-shadow 0.1s;
}
.db-gallery-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.db-gallery-cover {
	height: 80px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.db-gallery-cover-emoji { font-size: 28px; }
.db-gallery-body { padding: 8px 10px; }
.db-gallery-card-title { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.db-gallery-card-prop { display: flex; align-items: center; gap: 4px; font-size: 11px; margin-top: 3px; }
.db-gallery-prop-label { color: var(--vscode-descriptionForeground); flex-shrink: 0; }
.db-gallery-prop-value { display: flex; flex-wrap: wrap; gap: 2px; }
.db-gallery-add-card {
	background: var(--vscode-editor-background);
	border: 2px dashed var(--vscode-widget-border, rgba(128,128,128,0.3));
	border-radius: 4px;
	height: 80px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
}
.db-gallery-add-card:hover { border-color: var(--vscode-focusBorder); color: var(--vscode-foreground); }

/* ─── Calendar View ──────────────────────────────────────────── */
.db-calendar-root {
	display: flex;
	flex-direction: column;
	height: 100%;
}
.db-calendar-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 10px;
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
}
.db-calendar-title {
	font-size: 13px;
	font-weight: 600;
	min-width: 180px;
}
.db-calendar-grid {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
	grid-auto-rows: minmax(110px, 1fr);
	height: 100%;
}
.db-calendar-weekday {
	padding: 6px 8px;
	font-size: 11px;
	font-weight: 600;
	color: var(--vscode-descriptionForeground);
	border-right: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
}
.db-calendar-weekday:last-child { border-right: none; }
.db-calendar-cell {
	padding: 6px 6px 4px;
	border-right: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
	border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
	overflow: hidden;
	cursor: default;
}
.db-calendar-cell:nth-child(7n) { border-right: none; }
.db-calendar-cell:hover { background: var(--vscode-list-hoverBackground); }
.db-calendar-cell--muted { background: var(--vscode-editor-background); opacity: 0.45; }
.db-calendar-day {
	font-size: 11px;
	font-weight: 600;
	color: var(--vscode-descriptionForeground);
	margin-bottom: 4px;
}
.db-calendar-event {
	display: block;
	width: 100%;
	margin-bottom: 3px;
	padding: 3px 6px;
	border: 1px solid var(--vscode-button-border, var(--vscode-widget-border));
	border-radius: 3px;
	background: var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background));
	color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
	font-size: 11px;
	text-align: left;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: pointer;
}
.db-calendar-event:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground)); }
.db-calendar-more {
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
	padding: 1px 4px;
}

/* ─── Kanban Additions ───────────────────────────────────────── */
.db-kanban-col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.db-kanban-collapse-btn { margin-left: auto; }
.db-kanban-card-accent { height: 3px; border-radius: 4px 4px 0 0; margin: -10px -12px 8px; }
.db-kanban-card-actions {
	display: none;
	gap: 2px;
	margin-top: 6px;
	justify-content: flex-end;
}
.db-kanban-card:hover .db-kanban-card-actions { display: flex; }

/* ─── Record Editor Additions ────────────────────────────────── */
.db-record-header-actions { display: flex; gap: 4px; }
.db-record-auto-value { font-size: 12px; color: var(--vscode-descriptionForeground); }
.db-body-textarea { min-height: 100px; }
.db-btn-danger {
	background: transparent;
	color: var(--vscode-errorForeground);
	border-color: var(--vscode-errorForeground);
}
.db-btn-danger:hover { background: var(--vscode-inputValidation-errorBackground); }
.db-field-group-body { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-widget-border); }

/* ─── Schema Editor Additions ────────────────────────────────── */
.db-schema-row { position: relative; }
.db-fields-row--over.db-schema-row { border-top-color: var(--vscode-focusBorder); }
`;

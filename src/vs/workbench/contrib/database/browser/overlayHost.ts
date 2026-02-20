/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const THEME_VARIABLES = [
	'--vscode-color-scheme',
	'--vscode-menu-background',
	'--vscode-menu-foreground',
	'--vscode-menu-border',
	'--vscode-input-background',
	'--vscode-input-foreground',
	'--vscode-input-border',
	'--vscode-dropdown-background',
	'--vscode-dropdown-foreground',
	'--vscode-dropdown-border',
	'--vscode-dropdown-listBackground',
	'--vscode-dropdown-listForeground',
	'--vscode-list-hoverBackground',
	'--vscode-widget-border',
	'--vscode-foreground',
	'--vscode-descriptionForeground',
	'--vscode-focusBorder',
	'--vscode-font-family',
	'--vscode-editor-font-family',
	'--vscode-font-size',
	'--vscode-editorWidget-background',
	'--vscode-editor-background',
] as const;

function findThemeSurface(anchor: HTMLElement | undefined, host: HTMLElement): HTMLElement {
	if (!anchor) {
		return host;
	}

	const selectors = ['.db-editor-root', '.db-container', '.db-right', '.db-left', '.monaco-workbench'];
	for (const selector of selectors) {
		const match = anchor.closest(selector) as HTMLElement | null;
		if (match) {
			return match;
		}
	}
	return host;
}

function isLightColor(rgb: string): boolean {
	const match = rgb.match(/\d+(\.\d+)?/g);
	if (!match || match.length < 3) {
		return false;
	}
	const [r, g, b] = match.slice(0, 3).map(Number);
	const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	return luminance > 0.55;
}

function getOverlayHost(anchor: HTMLElement | undefined): HTMLElement {
	const doc = anchor?.ownerDocument ?? document;
	const fromAnchor = anchor?.closest('.monaco-workbench') as HTMLElement | null;
	if (fromAnchor) {
		return fromAnchor;
	}
	const workbench = doc.querySelector('.monaco-workbench') as HTMLElement | null;
	return workbench ?? doc.body;
}

function mirrorThemeVariables(overlay: HTMLElement, anchor: HTMLElement | undefined, host: HTMLElement): void {
	const surface = findThemeSurface(anchor, host);
	const surfaceStyle = getComputedStyle(surface);
	const sourceStyle = getComputedStyle(anchor ?? host);
	const hostStyle = getComputedStyle(host);
	for (const variable of THEME_VARIABLES) {
		const value = sourceStyle.getPropertyValue(variable).trim()
			|| surfaceStyle.getPropertyValue(variable).trim()
			|| hostStyle.getPropertyValue(variable).trim();
		if (value) {
			overlay.style.setProperty(variable, value);
		}
	}

	const bg = surfaceStyle.backgroundColor || hostStyle.backgroundColor || '#ffffff';
	const fg = surfaceStyle.color || hostStyle.color || '#1f1f1f';
	const light = isLightColor(bg);
	const border = light ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.18)';

	overlay.style.setProperty('--db-overlay-bg', bg);
	overlay.style.setProperty('--db-overlay-fg', fg);
	overlay.style.setProperty('--db-overlay-border', border);
	overlay.style.setProperty('--db-overlay-input-bg', bg);
	overlay.style.setProperty('--db-overlay-input-fg', fg);
}

export function appendDatabaseOverlay(overlay: HTMLElement, anchor?: HTMLElement): void {
	const host = getOverlayHost(anchor);
	host.appendChild(overlay);
	mirrorThemeVariables(overlay, anchor, host);
}

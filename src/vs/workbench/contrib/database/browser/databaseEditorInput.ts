/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IEditorSerializer, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

const databaseEditorIcon = registerIcon('database-editor-label-icon', Codicon.database, localize('databaseEditorLabelIcon', 'Icon of the database editor label.'));

export class DatabaseEditorInput extends EditorInput {

	static readonly ID = 'workbench.input.databaseEditor';

	override get typeId(): string {
		return DatabaseEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return DatabaseEditorInput.ID;
	}

	constructor(
		readonly resource: URI,
	) {
		super();
	}

	override getName(): string {
		const base = basename(this.resource);
		const fragment = this.resource.fragment ?? '';
		const prefix = 'record=';
		if (fragment.startsWith(prefix)) {
			const recordId = decodeURIComponent(fragment.slice(prefix.length));
			const short = recordId.slice(0, 8);
			return `${base} • ${short}`;
		}
		return base;
	}

	override getIcon(): ThemeIcon {
		return databaseEditorIcon;
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(otherInput)) {
			return true;
		}

		return otherInput instanceof DatabaseEditorInput && otherInput.resource.toString() === this.resource.toString();
	}
}

interface ISerializedDatabaseInput {
	resource: string;
}

export class DatabaseEditorInputSerializer implements IEditorSerializer {
	canSerialize(input: EditorInput): boolean {
		return input instanceof DatabaseEditorInput;
	}

	serialize(input: EditorInput): string | undefined {
		if (!(input instanceof DatabaseEditorInput)) {
			return undefined;
		}
		const data: ISerializedDatabaseInput = {
			resource: input.resource.toString(),
		};
		return JSON.stringify(data);
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): EditorInput | undefined {
		try {
			const data = JSON.parse(serializedEditorInput) as ISerializedDatabaseInput;
			return instantiationService.createInstance(DatabaseEditorInput, URI.parse(data.resource));
		} catch {
			return undefined;
		}
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, ViewContainerLocation, Extensions as ViewContainerExtensions, IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { EditorExtensions, IEditorFactoryRegistry, DEFAULT_EDITOR_ASSOCIATION } from '../../../common/editor.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { DatabaseViewPane } from './databaseViewPane.js';
import { DatabaseEditor } from './databaseEditor.js';
import { DatabaseEditorInput, DatabaseEditorInputSerializer } from './databaseEditorInput.js';

// Register the service
import './databaseService.js';
import '../common/databaseSync.js';

const DATABASE_VIEWLET_ID = 'workbench.view.database';
const DATABASE_VIEW_PANE_ID = 'workbench.panel.database';

const databaseViewIcon = registerIcon('database-view-icon', Codicon.database, localize('databaseViewIcon', 'View icon of the Database view.'));

const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: DATABASE_VIEWLET_ID,
	title: localize2('database', 'Database'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [DATABASE_VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: 'workbench.database.views.state',
	icon: databaseViewIcon,
	order: 8,
}, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: DATABASE_VIEW_PANE_ID,
	name: localize2('database', 'Database'),
	containerIcon: databaseViewIcon,
	ctorDescriptor: new SyncDescriptor(DatabaseViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	order: 0,
}], viewContainer);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		DatabaseEditor,
		DatabaseEditor.ID,
		localize('databaseEditor', 'Database Editor'),
	),
	[
		new SyncDescriptor(DatabaseEditorInput),
	],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(DatabaseEditorInput.ID, DatabaseEditorInputSerializer);

class DatabaseEditorContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.databaseEditor';

	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		editorResolverService.registerEditor(
			'*.db.json',
			{
				id: DatabaseEditorInput.ID,
				label: localize('promptOpenWith.databaseEditor.displayName', 'Database Editor'),
				detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
				priority: RegisteredEditorPriority.exclusive,
			},
			{
				singlePerResource: true,
				canSupportResource: resource => resource.path.toLowerCase().endsWith('.db.json'),
			},
			{
				createEditorInput: ({ resource }) => ({
					editor: instantiationService.createInstance(DatabaseEditorInput, resource),
					options: {
						pinned: true,
					},
				}),
			},
		);
	}
}

registerWorkbenchContribution2(DatabaseEditorContribution.ID, DatabaseEditorContribution, WorkbenchPhase.BlockStartup);

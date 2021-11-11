/********************************************************************************
 * Copyright (c) 2021 SAP SE or an SAP affiliate company and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable } from '@theia/core/shared/inversify';
import { TreeNode, CompositeTreeNode, SelectableTreeNode, ExpandableTreeNode, TreeImpl } from '@theia/core/lib/browser';
import { UriSelection } from '@theia/core/lib/common/selection';
import { BulkEditNodeSelection } from './bulk-edit-node-selection';
import URI from '@theia/core/lib/common/uri';
import { ResourceFileEdit, ResourceTextEdit } from '@theia/monaco/lib/browser/monaco-workspace';

@injectable()
export class BulkEditTree extends TreeImpl {
    public async initTree(edits: monaco.editor.ResourceEdit[], fileContents: Map<string, string>): Promise<void> {
        this.root = <CompositeTreeNode>{
            visible: false,
            id: 'theia-bulk-edit-tree-widget',
            name: 'BulkEditTree',
            children: this.getChildren(edits, fileContents),
            parent: undefined
        };
    }

    private getChildren(edits: monaco.editor.ResourceEdit[], fileContentsMap: Map<string, string>): BulkEditInfoNode[] {
        const bulkEditInfos: BulkEditInfoNode[] = [];
        if (edits) {
            const paths = new Set<string>();
            for (const edit of edits) {
                const path = this.getResourcePath(edit);
                if (path) {
                    paths.add(path);
                }
            }
            for (const path of paths) {
                const bulkEditInfo = this.createBulkEditInfo(path, new URI(path), fileContentsMap.get(path));
                if (bulkEditInfo) {
                    bulkEditInfos.push(bulkEditInfo);
                }
            }
            if (bulkEditInfos.length > 0) {
                for (const editInfo of bulkEditInfos) {
                    editInfo.children = edits.filter(edit =>
                        ((('resource' in edit) && (edit as monaco.editor.ResourceTextEdit)?.resource?.path === editInfo.id)) ||
                        (('newResource' in edit) && (edit as monaco.editor.ResourceFileEdit)?.newResource?.path === editInfo.id))
                        .map((edit, index) => this.createBulkEditNode(('resource' in edit ? edit as monaco.editor.ResourceTextEdit :
                            edit as monaco.editor.ResourceFileEdit), index, editInfo));
                }
            }
        }
        return bulkEditInfos;
    }

    private createBulkEditNode(bulkEdit: monaco.editor.ResourceFileEdit | monaco.editor.ResourceTextEdit, index: number, parent: BulkEditInfoNode): BulkEditNode {
        const id = parent.id + '_' + index;
        const existing = this.getNode(id);
        if (BulkEditNode.is(existing)) {
            existing.bulkEdit = bulkEdit;
            return existing;
        }
        return {
            id,
            name: 'bulkEdit',
            parent,
            selected: false,
            uri: parent.uri,
            bulkEdit
        };
    }

    private createBulkEditInfo(id: string, uri: URI, fileContents: string | undefined): BulkEditInfoNode {
        return {
            id,
            uri,
            expanded: true,
            selected: false,
            parent: this.root as BulkEditInfoNode,
            fileContents,
            children: []
        };
    }

    private getResourcePath(edit: monaco.editor.ResourceEdit): string | undefined {
        return ResourceTextEdit.is(edit) ? edit.resource.path :
            ResourceFileEdit.is(edit) && edit.newResource ? edit.newResource.path : undefined;
    }
}

export interface BulkEditNode extends UriSelection, SelectableTreeNode {
    parent: CompositeTreeNode;
    bulkEdit: monaco.editor.ResourceFileEdit | monaco.editor.ResourceTextEdit;
}
export namespace BulkEditNode {
    export function is(node: TreeNode | undefined): node is BulkEditNode {
        return UriSelection.is(node) && SelectableTreeNode.is(node) && BulkEditNodeSelection.is(node);
    }
}

export interface BulkEditInfoNode extends UriSelection, SelectableTreeNode, ExpandableTreeNode {
    parent: CompositeTreeNode;
    fileContents?: string;
}
export namespace BulkEditInfoNode {
    export function is(node: Object | undefined): node is BulkEditInfoNode {
        return ExpandableTreeNode.is(node) && UriSelection.is(node) && 'fileContents' in node;
    }
}

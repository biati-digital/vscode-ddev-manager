import * as vscode from 'vscode';
import { AppTypes, Databases, DDEV, DDEVSite, ServerTypes } from "./ddev";
import { getErrorMessage, getExtensionConfig, updateExtensionSettings } from './utils';


export class DDEVTree {
    readonly viewId = 'biatiddev';
    private _tree: vscode.TreeView<unknown>;
    private _sessionDisposable?: vscode.Disposable;
    private _provider: DDEVTreeViewProvider;
    private _loaded: boolean;

    constructor(private ddev: DDEV) {
        this._loaded = false;
        this._provider = new DDEVTreeViewProvider(ddev);
        this._tree = vscode.window.createTreeView<unknown>(this.viewId, {
            treeDataProvider: this._provider,
            showCollapseAll: false,
        });

        this._tree.onDidChangeVisibility(async () => {
            if (!this._loaded) {
                try {
                    this._loaded = true;
                    await this._provider.refresh(true);
                } catch (error) {
                    this._loaded = true;
                    const message = getErrorMessage(error);
                    if (message.includes('Could not connect to')) {
                        const message = `Could not connect to a docker provider.
                        Start or install a docker provider.
                        https://ddev.readthedocs.io`;
                        this._tree.message = message;
                        return;
                    }
                    this._tree.message = getErrorMessage(error);
                }
            }
        });
    }


    getprovider(): DDEVTreeViewProvider {
        return this._provider;
    }

    dispose(): void {
        this._tree.dispose();
        this._sessionDisposable?.dispose();
    }
}




type TreeItemData = {
    id?: string,
    label: string,
    description?: string,
    icon?: string,
    status?: string,
    url?: string,
    tooltip?: string,
    parent?: string,
    isParent?: boolean,
    absolutePath?: string,
    shortPath?: string,
    contextValue?: string,
    collapsibleState?: string,
    isDoingAction?: string,
    customStatusText?: string,
    children?: TreeItem[]
};

type ServiceType = {
    id?: string,
    label: string,
    contextValue: string,
    icon?: string,
    parent?: string,
    absolutePath?: string
};

export enum TreeViews {
    all = "All Projects",
    workspace = "Current Workspace",
}

export class TreeItem extends vscode.TreeItem {
    id?: string;
    url?: string;
    absolutePath?: string;
    shortPath?: string;
    isParent?: boolean;
    parent: string | undefined;
    children: TreeItem[] | undefined;
    icon?: string;
    isDoingAction?: string;
    customStatusText?: string;

    constructor(config: TreeItemData) {
        const {
            id,
            label,
            description,
            icon,
            status,
            children,
            tooltip,
            contextValue,
            url,
            isParent,
            parent,
            absolutePath,
            shortPath,
            collapsibleState,
            isDoingAction = '',
            customStatusText = '',
        } = config;

        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);

        this.id = id;
        this.children = children;
        this.tooltip = tooltip;
        this.description = description;
        this.url = url;
        this.absolutePath = absolutePath;
        this.shortPath = shortPath;
        this.isParent = isParent;
        this.parent = parent;
        this.icon = icon;
        this.isDoingAction = isDoingAction;
        this.customStatusText = customStatusText;
        if (collapsibleState === 'expanded') {
            this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        if (contextValue) {
            this.contextValue = contextValue;
        } else {
            this.contextValue = status === 'running' ? 'ddev_active' : 'ddev_inactive';
        }
    }
}


export class DDEVTreeViewProvider implements vscode.TreeDataProvider<TreeItem>
{
    ddev: DDEV;
    private listTypes = {
        all: 'All Projects',
        workspace: 'Current Workspace',
    };

    private doingRefresh: boolean;
    private listType = 'all';
    private configKey = 'ddevManager';
    private data: TreeViewData = new TreeViewData();
    private eventEmitter: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData?: vscode.Event<TreeItem | undefined> = this.eventEmitter.event;
    public treeVisible: boolean;

    public constructor(ddev: DDEV) {
        this.doingRefresh = false;
        this.treeVisible = false;
        this.ddev = ddev;

        vscode.workspace.onDidChangeConfiguration(event => {
            let configUpdated: boolean = event.affectsConfiguration("ddevManager");
            if (configUpdated) {
                const listType = getExtensionConfig(this.configKey, 'showProjectsList');
                if (this.listType !== listType) {
                    this.refresh();
                }
            }
        });
    }

    public getTreeItem(item: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (item.isParent) {
            const iconsStates: { [key: string]: string } = {
                'ddev_starting': 'loading~spin',
                'ddev_stopping': 'loading~spin',
                'ddev_restarting': 'loading~spin',
                'ddev_loading': 'loading~spin',
                'ddev_deleting': 'loading~spin',
                'ddev_active': 'vm-running',
                'ddev_inactive': 'vm',
            };

            if (item.contextValue && item.contextValue in iconsStates) {
                item.iconPath = new vscode.ThemeIcon(iconsStates[item.contextValue]);
            }
            if (item.isDoingAction !== '' || item.contextValue?.includes('_loading')) {
                item.iconPath = new vscode.ThemeIcon('loading~spin');
            }
        }

        return item;
    }

    public getTreeItemByID(id: string) {
        let found: boolean | TreeItem = false;
        const items = this.data.getData();
        for (const key in items) {
            const element = items[key];
            if (element.id === id) {
                found = element;
                break;
            }
        }
        return found;
    }


    public deleteTreeItem(item: TreeItem) {
        const id = item.id as string;
        this.ddev.deleteFromListCache(id);
        this.data.deleteItem(item);
        this.reloadTreeData();
    }


    public deleteTreeItemByID(id: string) {
        this.ddev.deleteFromListCache(id);
        const item = this.getTreeItemByID(id);
        if (item) {
            this.data.deleteItem(item);
            this.reloadTreeData();
        }
    }

    public getItemParent(item: TreeItem) {
        if (item.isParent) {
            return item;
        }

        if (item.parent) {
            return this.getTreeItemByID(item.parent);
        }
        return false;
    }

    public getChildren(element: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.data.getData();
        }

        if (!element.children?.length && element?.absolutePath && element.isParent) {
            const childItems = this.getServicesItems(element);
            return childItems;
        }

        return element.children;
    }


    public getServicesItems(element: TreeItem) {
        const childItems = [];
        if (!element || !element?.absolutePath || !element.isParent) {
            return;
        }

        const disableActionsIfContext = ['ddev_loading', 'ddev_poweringoff', 'ddev_restarting'];
        const config = this.ddev.parseConfigFile(element.absolutePath);
        const itemStatus: { [key: string]: string; } = {
            'ddev_active': 'Running',
            'ddev_doing_action': 'Processing...',
            'ddev_inactive': 'Stopped',
            'ddev_poweringoff': 'Stopping...',
            'ddev_stopping': 'Stopping...',
            'ddev_starting': 'Starting...',
            'ddev_restarting': 'Restarting...',
            'ddev_deleting': 'Deleting...',
        };

        let containerPath: string = element.absolutePath;
        let status: string = '';
        let context = '';
        if (element?.contextValue) {
            context = element.contextValue.replace('_loading', '');
            status = itemStatus[context];
        }
        if (element?.shortPath) {
            containerPath = element.shortPath;
        }
        if (element?.customStatusText) {
            status = element.customStatusText;
        }

        if (!status) {
            console.log('no status, context', element.contextValue);
        }

        const baseItems: ServiceType[] = [
            {
                label: `Status: ${status}`,
                icon: 'pulse',
                absolutePath: element.absolutePath,
                contextValue: 'ddev_status'
            },
            {
                // @ts-ignore
                label: `Server: ${ServerTypes[config.webserver_type]}`,
                icon: 'server-process',
                contextValue: 'ddev_type'
            },
            {
                // @ts-ignore
                label: `Type: ${AppTypes[config.type]}`,
                icon: 'package',
                contextValue: 'ddev_type'
            },
            {
                label: `Mutagen: ${config.mutagen_enabled ? 'Enabled' : 'Disabled'}`,
                icon: 'file-submodule',
                contextValue: 'ddev_mutagen'
            },
            {
                label: `URL: ${element?.url}`,
                icon: 'globe',
                contextValue: 'ddev_url'
            },
            {
                label: `Path: ${containerPath}`,
                icon: 'file-directory',
                contextValue: 'ddev_path'
            }
        ];

        for (const item of baseItems) {
            let checkContext = item.contextValue;
            if (element?.contextValue && disableActionsIfContext.includes(element.contextValue)) {
                checkContext = 'disabled';
            }
            item.parent = element.id;
            item.absolutePath = element.absolutePath;
            item.contextValue = checkContext;
            childItems.push(new TreeItem(item));
        }

        const services: ServiceType[] = [];
        if (config?.nodejs_version) {
            services.push({
                label: `NodeJS: ${config.nodejs_version}`,
                contextValue: 'ddev_nodejs'
            });
        }

        if (config?.php_version) {
            services.push({
                label: `PHP: ${config.php_version}`,
                contextValue: 'ddev_php'
            });
        }

        if (config?.database && config?.database?.type && config?.database?.version) {
            const dbType: string = config.database.type;
            const dbName: Databases = (<any>Databases)[dbType];
            services.push({
                label: `${dbName}: ${config.database.version}`,
                contextValue: `ddev_${dbType}`
            });
        }

        // let showPHPMyAdmin = true;
        // if (showPHPMyAdmin) {
        //     services.push({
        //         label: `PHP MyAdmin`,
        //         contextValue: 'ddev_phpmyadmin'
        //     });
        // }

        let showMailhog = true;
        if (showMailhog) {
            services.push({
                label: `Mailhog`,
                contextValue: 'ddev_mailhog'
            });
        }

        const servicesList = [];
        for (const item of services) {
            let checkContext = item.contextValue;
            if (element?.contextValue && disableActionsIfContext.includes(element.contextValue)) {
                checkContext = 'disabled';
            }

            item.parent = element.id;
            item.absolutePath = element.absolutePath;
            item.contextValue = checkContext;
            servicesList.push(new TreeItem(item));
        }

        childItems.push(new TreeItem({
            label: 'Services',
            icon: 'library',
            contextValue: 'ddev_services',
            collapsibleState: 'expanded',
            children: servicesList
        }));

        return childItems;
    }


    public setItemLoading(item: TreeItem) {
        item.contextValue = 'ddev_loading';
        this.reloadTreeData(item);
    }

    public setItemContextValue(item: TreeItem, contextValue: string) {
        item.contextValue = contextValue;
        this.reloadTreeData(item);
    }

    public updateItem(item: TreeItem, values: { [key: string]: any }) {
        for (const key in values) {
            let proname = key as string;
            // @ts-ignore
            item[proname] = values[key];
        }
        this.reloadTreeData(item);
    }

    public setItemsContextValue(contextValue: string): void {
        for (const item of this.data.getData()) {
            item.contextValue = contextValue;
        }
        this.reloadTreeData();
    }


    /**
     * Run command
     */
    public async runCommand({
        item,
        command,
        reloadTree = false,
        reloadItem = false,
        showLoading = false,
        throwError = false,
        preRunItemContext = '',
        successItemContext = '',
        customStatus = '',
    }: {
        item: TreeItem,
        command: string[],
        reloadTree?: boolean,
        reloadItem?: boolean,
        throwError?: boolean,
        showLoading?: boolean,
        preRunItemContext?: string,
        successItemContext?: string,
        errorItemContext?: string
        customStatus?: string
    }) {

        showLoading && this.setItemContextValue(item, item.contextValue + '_loading');
        item.customStatusText = customStatus ? customStatus : '';
        if (preRunItemContext) {
            this.setItemContextValue(item, preRunItemContext);
        }

        this.reloadTreeData(item);

        try {
            const out = await this.ddev.runCommand(command, item.absolutePath);
            if (reloadTree) {
                this.refresh(true);
                return out;
            }

            if (reloadItem) {
                this.refreshItem(item);
                return out;
            }

            item.customStatusText = '';
            showLoading && item.contextValue && this.setItemContextValue(item, item.contextValue?.replace('_loading', ''));
            this.reloadTreeData(item);

            if (successItemContext) {
                this.setItemContextValue(item, successItemContext);
            }

            return out;
        } catch (error) {
            let errorMessage = getErrorMessage(error);
            if (throwError) {
                throw new Error(errorMessage);
            }
            vscode.window.showErrorMessage(errorMessage);
            this.refresh(true);
            return;
        }
    }


    public async powerOff() {
        try {
            const off = await this.ddev.powerOff();
            this.data.eraseData();
            this.refresh(true);
        } catch (error) {
            vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }


    public async refresh(skipCache: boolean = false) {
        console.log('this.doingRefresh', this.doingRefresh);
        if (this.doingRefresh) {
            console.log('do not refresh');
            return;
        }

        this.doingRefresh = true;
        // this.data.eraseData();
        // this.loadContainersList(skipCache).then(() => {
        //     this.reloadTreeData();
        //     this.doingRefresh = false;
        // }).catch(error => {
        //     this.doingRefresh = false;
        //     console.log('no list found');
        //     console.log(error);
        // });

        try {
            this.data.eraseData();
            await this.loadContainersList(skipCache);
            this.reloadTreeData();
            this.doingRefresh = false;
        } catch (error) {
            this.doingRefresh = false;
            console.log('no list found');
            throw new Error(getErrorMessage(error));
        }
    }


    public async refreshItem(item: TreeItem) {
        try {
            const id = item.id as string;
            const list = await this.ddev.listContainers(true);
            const updatedItem = list.find(el => el.name === id);
            if (updatedItem) {
                this.data.replaceItem(id, this.createParentItem({
                    ...updatedItem,
                    collapsibleState: ''
                }));
                this.reloadTreeData();
            }
        } catch (error) { }
    }


    public reloadTreeData(element?: TreeItem | undefined) {
        this.eventEmitter.fire(element);
    }


    public setListContentType(display: string): void {
        vscode.commands.executeCommand('setContext', 'biatiddev.treeListShows', display);
        updateExtensionSettings(this.configKey, 'showProjectsList', this.getListTypeName(display));
    }

    public async loadContainersList(skipCache: boolean = false) {

        console.log('doing loadContainersList');

        let listType = this.getListTypeID();
        this.listType = listType as string;

        vscode.commands.executeCommand('setContext', 'biatiddev.treeListShows', listType);

        return new Promise((resolve, reject) => {
            this.ddev.listContainers(skipCache).then(list => {
                vscode.commands.executeCommand('setContext', 'ddev:isRunning', true);

                let ddevOnWorkspace: boolean | string = false;
                if (vscode.workspace.workspaceFolders !== undefined && listType === 'workspace') {
                    let wf = vscode.workspace.workspaceFolders[0].uri.path;
                    let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    let foundConfig = this.ddev.searchConfigFileFromPath(wf);
                    if (foundConfig.found) {
                        ddevOnWorkspace = foundConfig.configParsed?.name as string;
                    }
                }

                for (const key in list) {
                    const container: DDEVSite = list[key];
                    if (ddevOnWorkspace && container.name !== ddevOnWorkspace) {
                        continue;
                    }
                    if (!this.ddev.configFileExists(container.approot)) {
                        continue;
                    }

                    this.data.addItem(this.createParentItem({
                        ...container,
                        collapsibleState: ddevOnWorkspace || listType === 'workspace' ? 'expanded' : '',
                    }));
                }

                resolve(true);
            }).catch(error => {
                reject(error);
            });
        });

        // let list = [];
        // try {
        //     list = await this.ddev.listContainers(skipCache);

        //     vscode.commands.executeCommand('setContext', 'ddev:isRunning', true);

        //     let ddevOnWorkspace: boolean | string = false;
        //     if (vscode.workspace.workspaceFolders !== undefined && listType === 'workspace') {
        //         let wf = vscode.workspace.workspaceFolders[0].uri.path;
        //         let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
        //         let foundConfig = await this.ddev.searchConfigFileFromPath(wf);
        //         if (foundConfig.found) {
        //             ddevOnWorkspace = foundConfig.configParsed?.name as string;
        //         }
        //     }

        //     for (const key in list) {
        //         const container: DDEVSite = list[key];
        //         if (ddevOnWorkspace && container.name !== ddevOnWorkspace) {
        //             continue;
        //         }
        //         if (!this.ddev.configFileExists(container.approot)) {
        //             continue;
        //         }

        //         this.data.addItem(this.createParentItem({
        //             ...container,
        //             collapsibleState: ddevOnWorkspace || listType === 'workspace' ? 'expanded' : '',
        //         }));
        //     }

        // } catch (error) {
        //     if (getErrorMessage(error)) {
        //         vscode.commands.executeCommand('setContext', 'ddev:isRunning', false);
        //         this.data.addItem(new TreeItem({
        //             id: 'notrunning',
        //             label: 'Unable to Connect',
        //             description: 'Please start or install a docker provider',
        //             icon: 'warning'
        //         }));
        //     }
        // }
    }




    // public async loadContainersList(skipCache: boolean = false) {
    //     let list = [];
    //     let listType = this.getListTypeID();
    //     this.listType = listType as string;

    //     vscode.commands.executeCommand('setContext', 'biatiddev.treeListShows', listType);

    //     try {
    //         list = await this.ddev.listContainers(skipCache);

    //         vscode.commands.executeCommand('setContext', 'ddev:isRunning', true);

    //         let ddevOnWorkspace: boolean | string = false;
    //         if (vscode.workspace.workspaceFolders !== undefined && listType === 'workspace') {
    //             let wf = vscode.workspace.workspaceFolders[0].uri.path;
    //             let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
    //             let foundConfig = await this.ddev.searchConfigFileFromPath(wf);
    //             if (foundConfig.found) {
    //                 ddevOnWorkspace = foundConfig.configParsed?.name as string;
    //             }
    //         }

    //         for (const key in list) {
    //             const container: DDEVSite = list[key];
    //             if (ddevOnWorkspace && container.name !== ddevOnWorkspace) {
    //                 continue;
    //             }
    //             if (!this.ddev.configFileExists(container.approot)) {
    //                 continue;
    //             }

    //             this.data.addItem(this.createParentItem({
    //                 ...container,
    //                 collapsibleState: ddevOnWorkspace || listType === 'workspace' ? 'expanded' : '',
    //             }));
    //         }

    //     } catch (error) {
    //         if (getErrorMessage(error)) {
    //             vscode.commands.executeCommand('setContext', 'ddev:isRunning', false);
    //             this.data.addItem(new TreeItem({
    //                 id: 'notrunning',
    //                 label: 'Unable to Connect',
    //                 description: 'Please start or install a docker provider',
    //                 icon: 'warning'
    //             }));
    //         }
    //     }
    // }


    private createParentItem(container: { [key: string]: string }) {
        return new TreeItem({
            id: container.name,
            absolutePath: container.approot,
            shortPath: container?.shortroot,
            label: container.name,
            isParent: true,
            url: container?.httpsurl || container?.httpurl,
            collapsibleState: container.collapsibleState,
            status: container.status,
            children: []
        });
    }


    getListTypeID(): string {
        const searchName = getExtensionConfig(this.configKey, 'showProjectsList') as string;
        let foundID = '';
        for (const key in this.listTypes) {
            // @ts-expect-error: Do not know if the config file can change at any time
            const name = this.listTypes[key];
            if (searchName === name) {
                foundID = key;
                break;
            }
        }

        return foundID;
    }


    getListTypeName(searchKey: string): string {
        if (searchKey in this.listTypes) {
            const name: TreeViews = (<any>TreeViews)[searchKey];
            return name;
        }
        return '';
    }
}


class TreeViewData {
    private data: TreeItem[] = [];

    public addItem(item: TreeItem) {
        this.data.push(item);
    }

    public deleteItem(item: TreeItem) {
        this.data = this.data.filter(elm => elm !== item);
    }

    public replaceItem(id: string, newItem: TreeItem) {
        this.data = this.data.map(elm => {
            if (elm.id === id) {
                return newItem;
            }
            return elm;
        });
    }

    public getData() {
        return this.data;
    }

    public eraseData() {
        this.data = [];
    }

    public get contextValue(): string {
        return this.contextValue;
    }
}
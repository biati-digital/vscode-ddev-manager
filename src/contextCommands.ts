import * as vscode from 'vscode';
import { DDEVManager } from "./ddevManager";
import { TreeItem } from "./tree";
import { getCurrentDate, getErrorMessage } from './utils';

export function registerContextCommands(instance: DDEVManager): void {
    const DDEV = instance.getDDEV();
    const sidebar = instance.getSidebar();

    // Treeview title commands
    instance.registerCommand('treePowerOff', async () => {
        instance.logProcessOutput('Powering OFF DDEV...');
        instance.setContext('ddev:isRunning', false);
        instance.setContext('ddev:poweringOff', true);

        sidebar.setItemsContextValue('ddev_poweringoff');

        await sidebar.powerOff();

        instance.setContext('ddev:poweringOff', false);
    });

    instance.registerCommand('treeReloadList', () => {
        instance.refreshSidebar(true);
    });

    instance.registerCommand('treeAddProject', () => {
        instance.showEditForm();
    });

    instance.registerCommand('treeChangeToAllListView', () => {
        sidebar.setListContentType('all');
    });

    instance.registerCommand('treeChangeToWorkspaceListView', () => {
        sidebar.setListContentType('workspace');
    });

    //Context commands
    instance.registerCommand('contextStart', async (item: TreeItem) => {
        await sidebar.runCommand({
            item,
            preRunItemContext: 'ddev_starting',
            reloadItem: true,
            command: ['start', '--skip-confirmation'],
        });
    });

    instance.registerCommand('contextStop', (item: TreeItem) => {
        sidebar.runCommand({
            item,
            preRunItemContext: 'ddev_stopping',
            reloadItem: true,
            command: ['stop'],
        });
    });

    instance.registerCommand('contextStopOthers', async (item: TreeItem) => {
        try {
            const exclude = item?.id ? [item.id] : [];
            await instance.stopAllActiveProjects(exclude, (project) => {
                const treeItem = sidebar.getTreeItemByID(project.name);
                if (treeItem) {
                    sidebar.setItemContextValue(treeItem, 'ddev_stopping');
                }
            });
            sidebar.refresh(true);
        } catch (error) {

        }
    });

    instance.registerCommand('contextReload', (item: TreeItem) => {
        sidebar.runCommand({
            item,
            preRunItemContext: 'ddev_restarting',
            reloadItem: true,
            command: ['restart'],
        });
    });

    instance.registerCommand('contextOpenConfig', (item: TreeItem) => {
        if (item.absolutePath) {
            const configFile = DDEV.configFileExists(item.absolutePath);
            if (configFile) {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(configFile as string));
            }
        }
    });

    instance.registerCommand('contextOpenInBrowser', (item: TreeItem) => {
        sidebar.runCommand({ item, command: ['launch'] });
    });

    instance.registerCommand('contextRevealInOS', (item: TreeItem) => {
        if (item.absolutePath) {
            instance.revealInFinder(item.absolutePath);
        }
    });

    instance.registerCommand('contextOpenProjectInEditor', (item: TreeItem) => {
        if (item.absolutePath) {
            instance.openProjectInEditor(item.absolutePath);
        }
    });

    instance.registerCommand('contextDBLaunch', (item: TreeItem) => {
        instance.getDatabaseManager().openDatabaseInDatabaseManager({
            cwd: item.absolutePath
        });
    });

    instance.registerCommand('contextLaunch', (item: TreeItem) => {
        const command = ['launch'];
        const context = item.contextValue?.replace('ddev_', '');
        switch (context) {
            case 'phpmyadmin':
                command.push('--phpmyadmin');
                break;
            case 'mailhog':
                command.push('--mailhog');
                break;
            default:
                break;
        }

        console.log('command', command);
        sidebar.runCommand({ item, command: command });
    });


    instance.registerCommand('contextCreateSnapshot', async (item: TreeItem) => {
        const name = await vscode.window.showInputBox({
            placeHolder: "Enter snapshot name",
            prompt: "If empty DDEV will generate the name",
            value: ''
        });

        if (name === undefined) {
            return;
        }

        let project = sidebar.getItemParent(item);
        if (project) {
            let commandArgs = ['snapshot'];
            let message = 'Successfully created snapshot';
            if (name.trim() !== '') {
                commandArgs.push('--name="' + name.trim().replace(/,/g, '').replace(/ /g, '__') + '_' + getCurrentDate() + '"');
                message += `: ${name}`;
            }

            try {
                await sidebar.runCommand({
                    item: project,
                    showLoading: true,
                    customStatus: 'Creating Snapshot...',
                    command: commandArgs,
                    throwError: true
                });
                vscode.window.showInformationMessage(message);
            } catch (error) {
                vscode.window.showErrorMessage(`Error creating snapshot: ${getErrorMessage(error)}`);
            }
        }
    });


    instance.registerCommand('contextRestoreSnapshot', async (item: TreeItem) => {
        if (!item.absolutePath) {
            return;
        }

        const snapshot = await instance.showSnapshotsQuickPick(item.absolutePath);
        if (snapshot === undefined) {
            return;
        }

        let project = sidebar.getItemParent(item);
        let runData = {
            item,
            showLoading: true,
            customStatus: 'Restoring Snapshot...',
            command: ['snapshot', 'restore', snapshot.trim()],
            throwError: true
        };
        if (project) {
            runData.item = project;
        }
        try {
            await sidebar.runCommand(runData);
            const formatName = instance.formatSnapshotName(snapshot);
            vscode.window.showInformationMessage(`Succesfully restored snaphot: ${formatName.name} ${formatName.date}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error restoring snapshot: ${getErrorMessage(error)}`);
        }
    });

    instance.registerCommand('contextClearSnapshot', async (item: TreeItem) => {
        const clear = await vscode.window.showInformationMessage("Are you sure you want to clear all snapshots from this project? this action can not be undone.", "No", "Yes");

        if (clear !== 'Yes') {
            return;
        }

        let project = sidebar.getItemParent(item);
        if (project) {
            try {
                await sidebar.runCommand({
                    item: project,
                    showLoading: true,
                    customStatus: 'Clearing Snapshots...',
                    command: ['snapshot', '--cleanup', '-y'],
                    throwError: true
                });
                vscode.window.showInformationMessage('Successfully cleared all snapshots of this project');
            } catch (error) {
                vscode.window.showErrorMessage(`Error clearing snapshots: ${getErrorMessage(error)}`);
            }
        }
    });

    instance.registerCommand('contextEdit', async (item: TreeItem) => {
        const type = item.contextValue?.replace('ddev_', '');
        const data: { type?: string, prefix: string, placeholder: string, command: string } = { type, prefix: '', placeholder: '', command: '' };

        switch (type) {
            case 'php':
                data.prefix = 'PHP';
                data.placeholder = 'Select the PHP version to configure';
                data.command = '--php-version';
                break;
            case 'mysql':
                data.prefix = 'MySQL';
                data.placeholder = 'Select the MySQL version to configure';
                break;
            case 'nodejs':
                data.prefix = 'NodeJS';
                data.placeholder = 'Select the NodeJS version to configure';
                data.command = '--nodejs-version';
                break;
            default:
                break;
        }

        if (!data.type) {
            console.log('error');
            return;
        }

        const version = await instance.showVersionQuickPick(data.type, data.prefix, data.placeholder);
        if (!version) {
            return;
        }

        let parent = sidebar.getItemParent(item);
        if (parent) {
            item = parent;
            sidebar.setItemContextValue(item, 'ddev_restarting');
        }

        try {
            await DDEV.updateServiceVersion(data.command, version, item.absolutePath);
            vscode.window.showInformationMessage(`Successfully changed ${data.prefix} version to ${version}`);
            sidebar.refreshItem(item);

            // if PHP was updated make sure to update the workspace config
            if (type === 'php' && instance.getExtensionOption('automaticallyConfigureWorkspacePHP')) {
                instance.updateWorkspacePHPVersion(version);
            }
        } catch (error) {
            vscode.window.showErrorMessage(getErrorMessage(error));
        }
    });

    instance.registerCommand('contextMysqlSSH', (item: TreeItem) => {
        const project = sidebar.getItemParent(item);
        if (project) {
            const id = project.id as string;
            instance.createPseudoTerminal({
                id,
                name: `DDEV - ${id}:mysql`,
                message: 'Connecting to DDEV...',
                cwd: project.absolutePath as string,
                command: ['mysql'],
            });
        }
    });

    instance.registerCommand('openSSH', (item: TreeItem) => {
        const project = sidebar.getItemParent(item);
        if (project) {
            const id = project.id as string;
            instance.createPseudoTerminal({
                id,
                name: `DDEV - ${id}:ssh`,
                message: 'Connecting to DDEV...',
                cwd: project.absolutePath as string,
                command: ['ssh'],
            });
        }
    });

    instance.registerCommand('contextDelete', async (item: TreeItem) => {
        const project = sidebar.getItemParent(item);
        if (!project) {
            return;
        }

        const id = project.id as string;
        const deleted = await instance.deleteProject(id, () => sidebar.setItemContextValue(project, 'ddev_deleting'));

        if (deleted) {
            sidebar.deleteTreeItem(project);
        }
    });
}
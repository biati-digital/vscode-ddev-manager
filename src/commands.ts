import * as vscode from 'vscode';
import { DDEVManager } from "./ddevManager";
import { getCurrentDate, getErrorMessage } from './utils';


export function registerCommands(instance: DDEVManager): void {
    const DDEV = instance.getDDEV();
    const sidebar = instance.getSidebar();

    instance.registerCommand('showDDEVOutputChannel', () => {
        instance.showProcessOutput();
    });

    instance.registerCommand('poweroff', () => {
        instance.setContext('ddev:isRunning', false);
        instance.setContext('ddev:poweringOff', true);
        instance.runWorkspaceCommand({
            command: ['poweroff'],
            reloadTree: true,
            statusBar: 'DDEV Powering off...',
            successNotification: 'DDEV Power off completed',
        });
    });

    instance.registerCommand('start', () => {
        instance.runWorkspaceCommand({
            command: ['start', '--skip-confirmation'],
            reloadTree: true,
            statusBar: 'DDEV Starting...',
            successNotification: 'DDEV Started successfully',
        });
    });

    instance.registerCommand('stop', () => {
        instance.runWorkspaceCommand({
            command: ['stop'],
            reloadTree: true,
            statusBar: 'DDEV Stopping...',
            successNotification: 'DDEV Stopped successfully',
        });
    });

    instance.registerCommand('restart', () => {
        instance.runWorkspaceCommand({
            command: ['restart'],
            reloadTree: true,
            statusBar: 'DDEV Restarting...',
            successNotification: 'DDEV Restared successfully',
        });
    });

    instance.registerCommand('launchInBrowser', () => {
        instance.runWorkspaceCommand({ command: ['launch'] });
    });

    instance.registerCommand('launchMailhog', () => {
        instance.runWorkspaceCommand({ command: ['launch', '--mailhog'] });
    });

    instance.registerCommand('launchPHPMyAdmin', () => {
        instance.runWorkspaceCommand({ command: ['launch', '--phpmyadmin'] });
    });

    instance.registerCommand('launchDBManager', () => {
        instance.getDatabaseManager().openDatabaseInDatabaseManager();
    });

    instance.registerCommand('openConfigFile', async () => {
        let ddevConfig = await instance.getWorkspaceConfig();
        if (ddevConfig.found) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(ddevConfig.configPath));
        }
    });

    instance.registerCommand('createSnapshot', async () => {
        const name = await vscode.window.showInputBox({
            placeHolder: "Enter snapshot name",
            prompt: "If empty DDEV will generate the name",
            value: ''
        });
        if (name !== undefined) {
            let commandArgs = ['snapshot'];
            let message = 'DDEVSuccessfully created snapshot';
            if (name.trim() !== '') {
                commandArgs.push('--name="' + name.trim().replace(/ /g, '__') + '_' + getCurrentDate() + '"');
                message += `: ${name}`;
            }
            instance.runWorkspaceCommand({
                command: commandArgs,
                statusBar: 'DDEV Creating Snapshot...',
                successNotification: message,
            });
        }
    });

    instance.registerCommand('clearSnapshots', async () => {
        const clear = await vscode.window.showInformationMessage("Are you sure you want to clear all snapshots from this project? this action can not be undone.", "No", "Yes");
        if (clear === 'Yes') {
            instance.runWorkspaceCommand({
                command: ['snapshot', '--cleanup', '-y'],
                statusBar: 'DDEV Deleting Snapshots...',
                successNotification: 'Successfully cleared all snapshots of this project',
            });
        }
    });

    instance.registerCommand('restoreSnapshot', async () => {
        let ddevConfig = await instance.getWorkspaceConfig();
        if (!ddevConfig.found) {
            return false;
        }
        const snapshot = await instance.showSnapshotsQuickPick(ddevConfig.foundAtPath);
        if (snapshot !== undefined) {
            instance.runWorkspaceCommand({
                command: ['snapshot', 'restore', snapshot],
                statusBar: 'DDEV Restoring Snapshots...',
                successNotification: 'Successfully restored snapshot',
            });
        }
    });

    instance.registerCommand('editPHPVersion', async () => {
        let ddevConfig = await instance.getWorkspaceConfig();
        if (ddevConfig.found) {
            const version = await instance.showVersionQuickPick('php', 'PHP', 'Select the PHP version to configure');
            if (!version) {
                return;
            }

            instance.statusBarShow('Changing PHP Version...');

            try {
                await DDEV.updateServiceVersion('--php-version', version, ddevConfig.foundAtPath);
                instance.showSuccessNotification(`Successfully changed PHP version to ${version}`);
                instance.refreshSidebar(true);
                instance.statusBarHide();

                // if PHP was updated make sure to update the workspace config
                if (instance.getExtensionOption('automaticallyConfigureWorkspacePHP')) {
                    instance.updateWorkspacePHPVersion(version);
                }
            } catch (error) {
                instance.statusBarHide();
                instance.refreshSidebar(true);
                vscode.window.showErrorMessage(getErrorMessage(error));
            }
        }
    });

    instance.registerCommand('sshTerminal', async () => {
        let ddevConfig = await instance.getWorkspaceConfig(true);
        if (ddevConfig.found) {
            const id = ddevConfig.configParsed?.name as string;
            instance.createPseudoTerminal({
                id,
                name: `DDEV - ${id}:ssh`,
                message: 'Connecting to DDEV...',
                cwd: ddevConfig.foundAtPath as string,
                command: ['ssh'],
            });
        }
    });

    instance.registerCommand('mysqlTerminal', async () => {
        let ddevConfig = await instance.getWorkspaceConfig(true);
        if (ddevConfig.found) {
            const id = ddevConfig.configParsed?.name as string;
            instance.createPseudoTerminal({
                id,
                name: `DDEV - ${id}:mysql`,
                message: 'Connecting to DDEV...',
                cwd: ddevConfig.foundAtPath as string,
                command: ['mysql'],
            });
        }
    });

    instance.registerCommand('delete', async () => {
        let ddevConfig = await instance.getWorkspaceConfig(true);
        if (ddevConfig.found) {
            const id = ddevConfig.configParsed?.name as string;
            const deleted = await instance.deleteProject(id, () => instance.statusBarShow('Deleting DDEV project...'));

            if (deleted) {
                sidebar.deleteTreeItemByID(id);
            }
        }
    });
}
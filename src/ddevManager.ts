import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerContextCommands } from './contextCommands';
import { DDEVDatabaseManager } from "./databaseManager";
import { DatabaseManagers, DDEV, DDEVSite, DDEVSiteFindConfig } from "./ddev";
import { ConsoleLogger, Logger } from "./logger";
import { DDEVFormProjectPanel } from "./panels/editView";
import { DDEVPseudoTerminal, DDEVPseudoTerminalOptions } from './pseudoTerminal';
import { createTerminal } from './terminal';
import { DDEVTree, DDEVTreeViewProvider } from './tree';
import { getCurrentWorkspacePath, getErrorMessage, getExtensionConfig, updateWorspaceSettings } from './utils';

export class DDEVManager {
    private DDEV: DDEV;
    private _database: DDEVDatabaseManager;
    private _disposables: vscode.Disposable[] = [];
    private _statusBar: vscode.StatusBarItem;
    private _tree: DDEVTree;
    private _logger: Logger;
    private _platform: string;
    private _terminals: Map<string, vscode.Terminal>;
    private _projects: DDEVSite[];


    /**
     * The main controller constructor
     * @constructor
     */
    constructor(private _context: vscode.ExtensionContext) {
        this.DDEV = new DDEV();
        this._projects = [];
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._tree = new DDEVTree(this.DDEV);
        this._logger = new ConsoleLogger('DDEV');
        this._platform = process.platform;
        this._terminals = new Map<string, vscode.Terminal>();
        this._database = new DDEVDatabaseManager(this.DDEV);

        this._disposables.push(this._statusBar);
        this._disposables.push(this._tree);
        this._disposables.push(DDEVPseudoTerminal.registerTerminalProfile());
        // this._context.subscriptions.push(this);
    }


    /**
     * Initializes the extension
     */
    public async activate() {
        this.DDEV.setLogger((line) => this.logProcessOutput(line));
        registerCommands(this);
        registerContextCommands(this);

        if (this.getExtensionOption('automaticallyConfigureWorkspacePHP')) {
            this.verifyWorkspacePHPVersion();
        }
    }


    /**
     * Deactivate the controller
     */
    public deactivate(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
    }


    /**
     * Send data to the output channel
     * this panel can be visible by the user so it knows
     * the output of the commands that are executed.
     * Absolutely all executed commands are logged
     */
    public logProcessOutput(line: string): void {
        this._logger.append(line);
    }

    /**
     * Show the output channel
     */
    public showProcessOutput(): void {
        this._logger.show();
    }


    /**
     * Get workspace DDEV config
     * tries to find the .ddev/config.yml
     * from the current workspace
     */
    public getWorkspaceConfig(pased = false): DDEVSiteFindConfig {
        const workspace = getCurrentWorkspacePath();
        return this.DDEV.searchConfigFileFromPath(workspace as string, pased);
    }


    /**
     * Helper method to setup command registrations with arguments
     */
    public registerCommand(command: string, listener: (...args: any[]) => void): void {
        this._disposables.push(
            vscode.commands.registerCommand(`biatiddev.${command}`, listener)
        );
    }


    /**
     * Run DDEV command
     * only if it's a valid workspace with a DDEV project
     */
    async runWorkspaceCommand({ command, reloadTree = false, statusBar, successNotification }: { command: string[], reloadTree?: boolean, successNotification?: string, statusBar?: string }): Promise<void> {
        let ddevConfig = this.getWorkspaceConfig();
        if (!ddevConfig.found) {
            this.showNowDDEVWorkspaceWarning();
            return;
        }

        if (statusBar) {
            this.statusBarShow(statusBar);
        }

        try {
            await this.DDEV.runCommand(command, ddevConfig.foundAtPath);
            this.statusBarHide();

            if (successNotification) {
                this.showSuccessNotification(successNotification);
            }
            if (reloadTree) {
                this._tree.getprovider().refresh(true);
            }
        } catch (error) {
            this.statusBarHide();
            vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }


    /**
     * Verify workspace PHP version
     * when a new workspace from a DDEV project
     * is opened we need to make sure the workspace has
     * the same PHP version as DDEV
     */
    public async verifyWorkspacePHPVersion() {
        let ddevConfig = this.getWorkspaceConfig(true);
        if (!ddevConfig.found || !ddevConfig?.configParsed) {
            return;
        }

        const intelephensePHPVersion = getExtensionConfig('intelephense', 'environment.phpVersion');
        const phpVersion = getExtensionConfig('php', 'version');

        if (
            (intelephensePHPVersion && intelephensePHPVersion !== ddevConfig.configParsed.php_version) ||
            (phpVersion && phpVersion !== ddevConfig.configParsed.php_version)
        ) {
            this.updateWorkspacePHPVersion(ddevConfig.configParsed.php_version as string);
        }
    }


    /**
     * Delete project
     */
    public async deleteProject(id: string, onStart: (...args: any[]) => void | null): Promise<boolean> {
        const deleteProject = await vscode.window.showInformationMessage(`Are you sure you want to delete the project ${id}? this action only deletes DDEV information, databases and docker containers, it does not delete your project files.`, "No", "Yes");

        if (deleteProject !== 'Yes') {
            return false;
        }

        if (onStart !== null) {
            onStart();
        }

        let deleted = false;
        try {
            await this.DDEV.delete(id, ['--omit-snapshot']);
            this.statusBarHide();
            vscode.window.showInformationMessage(`Successfully deleted DDEV project: ${id}`);
            deleted = true;
        } catch (error) {
            this.statusBarHide();
            vscode.window.showErrorMessage(`Error deleting DDEV project: ${getErrorMessage(error)}`);
        }

        return deleted;
    }


    /**
     * Stop all projects
     * that are running and provide a exclude
     * list
     */
    public async stopAllActiveProjects(exclude: string[], beforeStop: (...args: any[]) => void | null): Promise<void> {
        try {
            const projects = await this.DDEV.listContainers();
            const activeProjects = projects.filter(project => project.status === 'running' && !exclude.includes(project.name));

            if (activeProjects.length) {
                const runs = [];
                for (const project of activeProjects) {
                    if (beforeStop) {
                        beforeStop(project);
                    }
                    runs.push(this.DDEV.runCommand(['stop', project.name]));
                }

                try {
                    const values = await Promise.all(runs);
                    vscode.window.showInformationMessage('All other projects stopped correctly.');
                } catch (error) {
                    vscode.window.showErrorMessage(getErrorMessage(error));
                }
            }
        } catch (error) {
            // TODO: show message if list of containers is not returned
        }
    }


    /**
     * Get the configured type
     */
    public getConfiguredDatabaseManager(): string {
        let app = getExtensionConfig('ddevManager', 'defaultDatabaseManager') as string;
        if (app in DatabaseManagers) {
            const managerApp: string = (<any>DatabaseManagers)[app];
            return managerApp;
        }

        throw new Error(`Database manager ${app} not available in DDEV`);
    }

    /**
     * Show edit form
     */
    public showEditForm() {
        DDEVFormProjectPanel.render(this._context?.extensionUri);
    }


    public getExtensionOption(option: string) {
        return getExtensionConfig('ddevManager', option);
    }


    /**
     * Return the DDEV instance
     */
    public getDDEV(): DDEV {
        return this.DDEV;
    }


    /**
     * Return the Database Manager instance
     */
    public getDatabaseManager(): DDEVDatabaseManager {
        return this._database;
    }


    /**
     * Return the tree instance
     * it gives direct access to the treeDataProvider
     */
    public getSidebar(): DDEVTreeViewProvider {
        return this._tree.getprovider();
    }


    /**
     * Show a list of snapshots
     */
    async showSnapshotsQuickPick(cwd: string): Promise<string | undefined> {

        try {
            const snapshots = await this.DDEV.getSnapshotsList(cwd);

            if (!snapshots.length) {
                vscode.window.showInformationMessage('There are no snapshots');
                return undefined;
            }

            let snapshotsList: { label: string, value: string, description?: string }[] = snapshots.map(snapshot => {
                let snapshotDetails = { label: '', value: '', description: '' };
                const parsed = this.formatSnapshotName(snapshot.trim());

                snapshotDetails.label = parsed.name;
                snapshotDetails.value = parsed.id;

                if (parsed.date) {
                    snapshotDetails.description = parsed.date;
                }
                return snapshotDetails;
            });

            const selected = await vscode.window.showQuickPick(snapshotsList,
                { placeHolder: 'Select a snapshot' });

            return selected?.value;
        } catch (error) {
            vscode.window.showErrorMessage(getErrorMessage(error));
        }

        return undefined;
    }


    /**
     * Format snapshot name
     * make it easier for users to see the name
     * and date
     */
    public formatSnapshotName(name: string): { name: string, date: string, id: string } {
        let snapshotData = { name: '', date: '', id: name.trim() };
        name = name.trim().replace(/__/g, ' ');
        name = name.trim().replace(/_(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/, '__$2/$3/$1 $4:$5:$6');

        snapshotData.name = name;

        if (name.includes('__')) {
            let data = name.split('__');
            snapshotData.name = data[0].trim();
            snapshotData.date = data[1].trim();
        }

        return snapshotData;
    }


    /**
     * Show a quick pick to
     * select the service version
     */
    async showVersionQuickPick(type: string, prefix: string, placeholder: string): Promise<string | undefined> {
        let options: { label: string, value: string }[] = [];
        let availableVersions = this.DDEV.getAvailableVersionsForService(type);

        if (!availableVersions.length) {
            vscode.window.showErrorMessage(`Unable to find available versions for service: ${type}`);
            return undefined;
        }

        options = availableVersions.map(version => {
            return { label: `${prefix} ${version}`, value: version };
        });

        const version = await vscode.window.showQuickPick(options,
            { placeHolder: placeholder });

        return version?.value;
    }


    /**
     * Update workspace PHP version
     */
    async updateWorkspacePHPVersion(version: string) {
        this.updateWorspaceSettings('intelephense', 'environment.phpVersion', version);
        this.updateWorspaceSettings('php', 'version', version);
    }


    /**
     * Refresh the treeview
     */
    public refreshSidebar(skipCache: boolean = false): void {
        this._tree.getprovider().refresh(skipCache);
    }


    /**
     * Show statusbar
     */
    public statusBarShow(message: string = '', tooltip: string = ''): void {
        let showStatusBar = getExtensionConfig('ddevManager', 'showStatusBarProcessIndicator');
        if (!showStatusBar) {
            this._statusBar.show();
            return;
        }

        let barText = "Click to show the process progress";
        let tooltipText = "Click to show the output panel";
        if (message) {
            barText = message;
        }
        if (tooltip) {
            tooltipText = tooltip;
        }
        this._statusBar.command = 'biatiddev.showDDEVOutputChannel';
        this._statusBar.text = `$(loading~spin) ${barText}`;
        this._statusBar.tooltip = tooltipText;
        this._statusBar.show();
    }


    /**
     * Hide the status bar
     */
    public statusBarHide(): void {
        this._statusBar.hide();
    }


    /**
     * Reveal the project path
     * in the OS file explorer
     */
    public revealInFinder(path: string): void {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path));
    }


    /**
     * Open folder in editor window
     * later we can extend it to configure
     * if it should open in a new window
     * or add it as a workspace folder
     * or even replace the current folder
     * in the workspace
     */
    public openProjectInEditor(path: string): void {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path), {
            forceNewWindow: true
        });
    }


    public async createPseudoTerminal(options: DDEVPseudoTerminalOptions) {
        const terminal = new DDEVPseudoTerminal(options);
        terminal.show();
    }


    public async createSSHTerminal(projectID: string) {
        const terminal = await createTerminal({
            id: projectID,
            name: `DDEV - ${projectID}`,
            message: 'Connecting to DDEV...',
            cwd: '',
            command: `ddev ssh ${projectID}`
        });

        this._terminals.set(projectID, terminal);
        this._disposables.push(terminal);

        return terminal;
    }


    /**
     * Open terminal
     */
    public async openSSHTerminal(projectID: string): Promise<vscode.Terminal> {
        const terminalInstance = this._terminals.get(projectID);
        if (terminalInstance) {
            // Make sure terminal has not been killed by user
            if (terminalInstance.exitStatus === undefined) {
                terminalInstance.show();
                return terminalInstance;
            }

            // clear the already disposed terminal
            this.deleteTerminal(projectID);
        }

        const create = await this.createSSHTerminal(projectID);
        create.show();
        return create;
    }


    /**
     * Delete terminal from project
     */
    public deleteTerminal(projectID: string): void {
        const terminalInstance = this._terminals.get(projectID);
        if (terminalInstance) {
            terminalInstance.dispose();
            this._terminals.delete(projectID);
        }
    }


    /**
     * Show an error message when
     * the current workspae is not a DDEV project
     * and a command is executed
     */
    public showNowDDEVWorkspaceWarning(): void {
        vscode.window.showErrorMessage('The current workspace does not appear to be a DDEV project.');
    }


    public updateWorspaceSettings(configName: string, settingName: string, settingValue: unknown) {
        return updateWorspaceSettings(configName, settingName, settingValue);
    }



    public getProjectsList() {
        return this.DDEV.listContainers();
    }


    /**
     * Show success notification
     * displays a success notification
     * if the they are enabled in the
     * extension settings
     */
    showSuccessNotification(message: string = ''): void {
        let showNotification = getExtensionConfig('ddevManager', 'showSuccessNotifications');
        if (!showNotification) {
            return;
        }

        vscode.window.showInformationMessage(message);
    }


    /**
     * Set global context
     * used so we can configure correctly the
     * treeview and hide or show commands depending
     * on the current context
     */
    setContext(name: string, value: unknown): void {
        vscode.commands.executeCommand('setContext', name, value);
    }
}
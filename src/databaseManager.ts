import * as vscode from "vscode";
import { DatabaseManagers, DDEV } from "./ddev";
import { getErrorMessage, getExtensionConfig } from "./utils";

export interface DatabaseManagerOptions {
    id?: string,
    cwd?: string
}

export class DDEVDatabaseManager {
    constructor(
        private ddev: DDEV
    ) {

    }

    /**
     * Open the database manager
     */
    public openDatabaseInDatabaseManager(options?: DatabaseManagerOptions): void {
        const app = this.getConfiguredAppManager();
        let cwd = options?.cwd;

        if (app === 'none') {
            vscode.window.showInformationMessage("Configure the database manager that you want to use.", "Configure", "Cancel")
                .then(answer => {
                    if (answer === "Configure") {
                        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:biati.ddev-manager DefaultDatabaseManager');
                    }
                });
            return;
        }

        if (app === 'phpmyadmin' || app === 'adminer') {
            this.maybeInstallService(app);
            return;
        }

        if (app === 'database-client') {
            vscode.window.showInformationMessage('opening in extension');
            return;
        }

        try {
            this.ddev.runCommand([app], cwd);
        } catch (error) {
            vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }


    public maybeInstallService(serviceID: string) {

    }


    /**
     * Get the configured database app manager
     */
    public getConfiguredAppManager(): string {
        let app = getExtensionConfig('ddevManager', 'defaultDatabaseManager') as string;

        if (app === 'Not configured') {
            return 'none';
        }

        if (app === 'PHP MyAdmin') {
            return 'phpmyadmin';
        }

        if (app === 'Adminer') {
            return 'adminer';
        }

        // VS Code Extension
        if (app === 'VS Code Database Client extension') {
            return 'database-client';
        }

        if (app in DatabaseManagers) {
            const managerApp: string = (<any>DatabaseManagers)[app];
            return managerApp;
        }

        throw new Error(`Database manager ${app} not available in DDEV`);
    }


    public openInDatabaseClientExtension() {
        // executeCommand mysql2.refresh
    }
}
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from "path";
import * as vscode from "vscode";
import { parse } from 'yaml';
import { getErrorMessage } from "./utils";


export interface DDEVSite {
    status: string,
    name: string,
    type: string,
    approot: string,
    docroot?: string,
    shortroot?: string,
    httpsurl?: string,
    httpurl?: string,
    [key: string]: unknown,
}

export enum Databases {
    mysql = "MySQL",
    mariadb = "MariaDB",
    postgre = "PostgreSQL"
}

export enum DatabaseManagers {
    "TablePlus" = 'tableplus',
    "Sequel Ace" = 'sequelace',
    "Querious" = 'sequelpro',
    "Sequel Pro" = 'querious'
}

export enum AppTypes {
    wordpress = "WordPress",
    typo3 = "Typo3",
    backdrop = "Backdrop",
    craftcms = "Craft CMS",
    laravel = "Laravel",
    magento = "Magento",
    magento2 = "Magento 2",
    php = "PHP App",
    shopware6 = "Shopware 6",
    drupal6 = "Drupal 6",
    drupal7 = "Drupal 7",
    drupal8 = "Drupal 8",
    drupal9 = "Drupal 9",
    drupal10 = "Drupal 10",
}

export enum ServerTypes {
    'nginx-fpm' = 'NGINX',
    'apache-fpm' = 'Apache',
}

type DDEVConfigParsed = {
    [key: string]: unknown
};

export type DDEVSiteFindConfig = {
    found: boolean,
    foundAtPath: string,
    configPath: string,
    configParsed?: DDEVConfigParsed,
};


/**
 * Main DDEV Class
 */
export class DDEV {
    private list: DDEVSite[] = [];
    private phpVersions = ['8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6'];
    private mysqlVersions = ['8.0', '5.7', '5.6', '5.5'];
    private mariadbVersions = ['10.8', '10.7', '10.6', '10.5', '10.4', '10.3', '10.2', '10.1', '10.0', '5.5'];
    private postgressVersions = ['15', '14', '13', '12', '11', '10', '9'];
    private nodejsVersions = ['18', '16', '14'];
    private _logger: (line: string) => void;

    constructor() {
        this._logger = (line) => { console.log(line); };
    }

    /**
     * Poweroff
     * Completely stop all projects and containers.
     * https://ddev.readthedocs.io/en/stable/users/basics/commands/#poweroff
     */
    async powerOff() {
        return await this.runCommand(['poweroff']);
    }


    /**
     * Poweroff
     * Completely stop all projects and containers.
     * https://ddev.readthedocs.io/en/stable/users/basics/commands/#delete
     */
    async delete(project: string, args: string[] = []) {
        return await this.runCommand(['delete', project, '--yes', ...args]);
    }


    /**
     * List containers
     * returns a list of all containers as json
     * https://ddev.readthedocs.io/en/stable/users/basics/commands/#list
     */
    public async listContainers(skipCache = false): Promise<DDEVSite[]> {
        let list: DDEVSite[] = [];
        // Get cached containers list
        if (!skipCache && this.list.length) {
            list = this.list;
            return list;
        }

        const getList = await this.runCommand(['list', '--json-output']);
        list = JSON.parse(getList).raw;
        this.list = list;
        return list;
    }

    /**
     * Delete item from cached list
     */
    public deleteFromListCache(id: string): void {
        if (this.list.length) {
            this.list = this.list.filter(item => item.name !== id);
        }
    }


    /**
     * List DDEV Add-ons
     */
    public async listAddons(all: boolean = true) {
        let list = [];
        const commandArgs = ['get', '--list', '--json-output'];
        if (all) {
            commandArgs.push('--all');
        }

        const getAddons = await this.runCommand(commandArgs);
        list = JSON.parse(getAddons).raw;
        return list;
    }


    /**
     * Update service version
     * updates the config file and triggers a restart
     */
    async updateServiceVersion(service: string, version: string, path: string | undefined): Promise<string | boolean> {
        try {
            await this.runCommand(['config', service, version], path);
            await this.runCommand(['restart'], path);
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }

        return true;
    }


    /**
     * Run DDEV command
     * all commands are prefixed with ddev
     */
    async runCommand(args: string[], path?: string | undefined, token?: vscode.CancellationToken): Promise<string> {
        let opts: { cwd?: string } = {};
        if (path && typeof path === 'string') {
            opts.cwd = path;
        }

        return new Promise((resolve, reject) => {
            const options = { detached: true, shell: true };
            const runner = spawn('ddev', args, { ...options, ...opts });
            let data = { error: '', output: '' };

            if (token) {
                token.onCancellationRequested(() => {
                    console.log('[ddev] operation was canceled by token');
                    runner.kill();
                });
            }

            runner.stdout.setEncoding('utf8');
            runner.stdout.on('data', (stdout) => {
                const out: string = stdout.toString();
                let log = true;
                if (out.includes('"level":"info"') && out.includes('"raw":[{"approot"')) {
                    log = false;
                }

                if (log) {
                    this.writeLog(out);
                }
                // console.log(out);
                data.output += out;
            });

            runner.stderr.setEncoding('utf8');
            runner.stderr.on('data', (stderr) => {
                const err = stderr.toString();
                this.writeLog(err);
                data.error += err;
            });

            runner.on('close', (exitCode) => {
                if (exitCode === 0) {
                    data.error = '';
                }
                if (exitCode && exitCode > 0) {
                    data.output = '';
                    this.writeLog(`An error was returned while executing a DDEV command ${args.join(' ')}`);
                    reject(data.error);
                }

                runner.kill();
                resolve(data.output);
            });
        });
    }


    /**
     * Get all versions available in DDEV
     * for a specific service
     */
    public getAvailableVersionsForService(service: string): string[] {
        let availableVersions: string[] = [];

        switch (service) {
            case 'php':
                availableVersions = this.phpVersions;
                break;
            case 'mysql':
                availableVersions = this.mysqlVersions;
                break;
            case 'mariadb':
                availableVersions = this.mariadbVersions;
                break;
            case 'postgress':
                availableVersions = this.postgressVersions;
                break;
            case 'nodejs':
                availableVersions = this.nodejsVersions;
                break;
            default:
                break;
        }

        return availableVersions;
    }


    /**
     * List DDEV Add-ons
     */
    public async getSnapshotsList(cwd: string): Promise<string[]> {
        const snapshots = await this.runCommand(['snapshot', '--list'], cwd);

        let response = snapshots;
        if (response.includes(' no snapshots')) {
            vscode.window.showInformationMessage(response);
            return [];
        }

        response = response.trim().substring(response.indexOf(":") + 1);
        response = response.substring(0, response.indexOf('['));
        response = response.replace(/[^a-zA-Z0-9_,\.]/g, '');

        return response.split(',');
    }


    /**
     * Set reaload context
     * notify the editor that ddev is reloading
     */
    static setReloadingContext(status: boolean): void {
        vscode.commands.executeCommand('setContext', 'ddev:isReloading', status);
    }


    /**
     * Parse DDEV config file
     */
    parseConfigFile(appPath: string): any {
        const configPath = `${appPath}/.ddev/config.yaml`;
        let config = false;
        try {
            let file = fs.readFileSync(configPath, 'utf8');
            config = parse(file);
        } catch (err) { }

        return config;
    }


    /**
     * Check if config file exists
     * its checks for .ddev/config.yaml
     */
    configFileExists(appPath: string): boolean | string {
        let exists = false;
        let configPath = `${appPath}/.ddev/config.yaml`;
        try {
            exists = fs.existsSync(configPath);
        } catch (error) { }

        if (exists) {
            return configPath;
        }

        return false;
    }


    /**
     * Search for DDEV config file
     * it will if not found in the current workspace
     * it will also search in parent directories
     */
    searchConfigFileFromPath(fromPath: string, parse: boolean = true): DDEVSiteFindConfig {
        if (!fromPath || fromPath === '/') {
            return { found: false, foundAtPath: '', configPath: '' };
        }

        if (this.configFileExists(fromPath)) {
            let out: DDEVSiteFindConfig = {
                found: true,
                foundAtPath: fromPath,
                configPath: path.join(fromPath, '.ddev/config.yaml'),
            };
            if (parse) {
                out.configParsed = this.parseConfigFile(fromPath);
            }
            return out;
        }

        return this.searchConfigFileFromPath(path.join(fromPath, '../'));
    }


    /**
     * Write to log
     * if a logger fn is defined
     */
    private writeLog(line: string) {
        if (this._logger) {
            this._logger(line);
        }
    }



    /**
     * Set a custom log function
     */
    public setLogger(fn: (line: string) => void) {
        this._logger = fn;
    }
}

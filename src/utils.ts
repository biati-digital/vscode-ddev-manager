import * as vscode from "vscode";
import { spawn } from 'child_process';
import { Uri, Webview } from "vscode";
import { ConfigurationTarget, workspace } from 'vscode';

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
    // @ts-ignore
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}


/**
 * Return extension configuration
 */
export function getExtensionConfig(configName: string, key: string = ''): unknown {
    if (key) {
        return vscode.workspace.getConfiguration(configName).get(key);
    }

    return vscode.workspace.getConfiguration(configName);
}


export function updateExtensionSettings(configName: string, settingName: string, settingValue: unknown) {
    const configuration = workspace.getConfiguration(configName);
    return configuration.update(settingName, settingValue, ConfigurationTarget.Global);
}

export function updateWorspaceSettings(configName: string, settingName: string, settingValue: unknown) {
    const configuration = workspace.getConfiguration(configName);
    return configuration.update(settingName, settingValue, ConfigurationTarget.Workspace);
}


/**
 * Get current workspace folder
 */
export function getCurrentWorkspacePath(): string {
    if (vscode.workspace.workspaceFolders === undefined) {
        return '';
    }

    return vscode.workspace.workspaceFolders[0].uri.fsPath;
    // return vscode.workspace.workspaceFolders[0].uri.path;
}



function generateRandomString(myLength = 20) {
    const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
    const randomArray = Array.from(
        { length: myLength },
        (v, k) => chars[Math.floor(Math.random() * chars.length)]
    );

    const randomString = randomArray.join('');
    return randomString;
}


export function getErrorMessage(error: Error | string | unknown): string {
    let message = '';
    if (error instanceof Error) {
        message = error.message;
    } else {
        message = String(error);
    }

    return message;
}

export function getCurrentDate() {
    const date = new Date();
    const year = date.toLocaleString("default", { year: "numeric" });
    const month = date.toLocaleString("default", { month: "2-digit" });
    const day = date.toLocaleString("default", { day: "2-digit" });
    const hours = ("0" + date.getHours()).slice(-2);
    const minutes = ("0" + date.getMinutes()).slice(-2);
    const seconds = ("0" + date.getSeconds()).slice(-2);

    return year + month + day + hours + minutes + seconds;
}

export function execShellCommand(cmd: string, args: string[], opts = {}): Promise<{ error: string, output: string }> {
    return new Promise(function (resolve, reject) {
        const options = { detached: true, shell: true };
        const runner = spawn(cmd, args, { ...options, ...opts });
        let data = { error: '', output: '' };

        if (runner?.pid) {
            console.log('spawn started with process id', runner);
        }

        runner.stdout.setEncoding('utf8');
        runner.stdout.on('data', (stdout) => {
            const out: string = stdout.toString();
            let log = true;
            if (out.includes('"level":"info"') && out.includes('"raw":[{"approot"')) {
                log = false;
            }

            if (log) {
                // DDEV.writeProcessOutput(out);
            }
            data.output += out;
        });

        runner.stderr.setEncoding('utf8');
        runner.stderr.on('data', (stderr) => {
            const err = stderr.toString();
            // DDEV.writeProcessOutput(err);
            data.error += err;
        });

        runner.on('close', (exitCode) => {
            if (exitCode === 0) {
                data.error = '';
            }

            if (exitCode && exitCode > 0) {
                data.output = '';
            }

            runner.kill();

            if (runner?.pid) {
                // process.kill(runner.pid, 'SIGINT');
            }
            // runner.stdin.end();

            console.log('data', data);
            // const errorReturned = data.error.toLocaleLowerCase();
            // if (errorReturned.includes('mysql://')) {
            //     data.error = '';
            // }
            // if (data.output.includes('configuration complete') && data.output.includes('ddev start')) {
            //     data.error = '';
            // }

            // if (data.output && errorReturned.includes('mutagen sync completed with problems')) {
            //     data.error = '';
            // }

            resolve(data);
        });
    });
}
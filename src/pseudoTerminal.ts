// @ts-nocheck
import * as vscode from 'vscode';
import * as path from 'path';
import { getCurrentWorkspacePath } from './utils';

export interface DDEVPseudoTerminalOptions extends vscode.TerminalOptions {
    id: string,
    command: string[],
}

export class DDEVPseudoTerminal {
    public options: DDEVPseudoTerminalOptions;
    public writeEmitter: vscode.EventEmitter;
    public terminal: vscode.Terminal;
    public pty: vscode.Pseudoterminal;
    public ptyProcess;
    public killed: boolean;


    /**
     * The main controller constructor
     * @constructor
     */
    constructor(options: DDEVPseudoTerminalOptions) {
        this.options = options;
        this.writeEmitter = new vscode.EventEmitter<string>();
        this.terminal = this.createTerminal(options.name);
        this.killed = false;
    }


    /**
     * Creates a vscode terminal, it uses the bundled
     * vscode node-pty to provide all the functionality
     */
    private createTerminal(name: string): vscode.Terminal {
        const writeEmitter = this.writeEmitter;
        const terminalOptions = {
            name: name,
            pty: {
                onDidWrite: writeEmitter.event,
                open: async () => {
                    if (this.options.message) {
                        writeEmitter.fire(`${this.options.message}\r\n`);
                    }

                    setTimeout(async () => {
                        //@ts-ignore
                        if (!this.ptyProcess) {
                            this.ptyProcess = await this.createProcessPTY();
                        }
                        //@ts-ignore
                        this.ptyProcess.onData((data) => {
                            writeEmitter.fire(data);
                        });
                        this.ptyProcess.onExit(() => {
                            writeEmitter.fire(`\r\nDDEV Session ended\r\n`);
                            this.kill();
                        });
                    }, 100);
                },
                close: () => {
                    this.kill();
                },
                handleInput: (char: string) => this.ptyProcess.write(char),
            },
        };
        return vscode.window.createTerminal(terminalOptions);
    }


    /**
     * Creates the main node-pty process
     */
    private async createProcessPTY() {
        return new Promise(async (resolve, reject) => {
            // const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
            const spawn = await DDEVPseudoTerminal.getCoreNodePty();
            this.ptyProcess = spawn('ddev', this.options.command, {
                // name: 'xterm-color',
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                env: process.env,
                cwd: this.options.cwd,
                // cwd: process.cwd(),
            });
            resolve(this.ptyProcess);
        });
    }


    /**
     * Kill everything
     */
    public kill() {
        console.log('Killed');
        this.ptyProcess.kill();
        this.dispose();
        this.killed = true;
    }

    /**
     * Get the main pty process
     */
    public getProcess() {
        return this.ptyProcess;
    }


    /**
     * Get terminal instance
     */
    public getTerminal() {
        return this.terminal;
    }


    /**
     * Show terminal
     */
    public show() {
        return this.terminal.show();
    }


    /**
     * Check if terminal has been killed
     */
    public isKilled() {
        return this.killed;
    }


    /**
     * Dispose
     */
    public dispose() {
        this.ptyProcess.dispose();
        this.terminal.dispose();
        this.writeEmitter.dispose();
    }


    /**
     * Include native module directly from vscode
     * vscode does not offer a way to get native modules
     * and it's out of the question to bundle and maintain
     * a native module with each vscode/electron update
     */
    static getCoreNodePty() {
        //@ts-ignore
        const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
        const moduleName2 = path.join(vscode.env.appRoot, "node_modules.asar", "node-pty");
        //@ts-ignore
        const spawn: typeof import('node-pty').spawn = requireFunc(moduleName2).spawn;
        return spawn;
    }


    /**
     * Register terminal profile
     * this allows the user to create a new
     * terminal to connect to the DDEV container
     * using the vscode terminal ui
     */
    static registerTerminalProfile() {
        return vscode.window.registerTerminalProfileProvider("biatiddev.sshterminal", {
            provideTerminalProfile: (cancel) => {
                let writeEmitter = new vscode.EventEmitter<string>();
                let cwd = getCurrentWorkspacePath();
                let ptyProcess;

                return new vscode.TerminalProfile({
                    name: "DDEV - SSH",
                    pty: {
                        onDidWrite: writeEmitter.event,
                        open: () => {
                            if (!cwd) {
                                writeEmitter.fire(`Error: You need to open a workspace containing a DDEV Project.\r\n`);
                                return;
                            }

                            writeEmitter.fire(`Connecting to DDEV...\r\n`);

                            setTimeout(async () => {
                                if (!ptyProcess) {
                                    const spawn = await DDEVPseudoTerminal.getCoreNodePty();
                                    ptyProcess = spawn('ddev', ['ssh'], {
                                        name: 'xterm-256color',
                                        cols: 80,
                                        rows: 30,
                                        env: process.env,
                                        cwd: cwd,
                                    });
                                }
                                ptyProcess.onData((data) => {
                                    writeEmitter.fire(data);
                                });
                                ptyProcess.onExit(() => {
                                    writeEmitter.fire(`\r\nDDEV Session ended\r\n`);
                                    ptyProcess.kill();
                                });
                            }, 100);
                        },
                        close: () => {
                            ptyProcess && ptyProcess.kill();
                        },
                        handleInput: (char: string) => {
                            ptyProcess && ptyProcess.write(char);
                        },
                    },
                });
            }
        });
    }
}
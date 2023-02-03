import * as vscode from 'vscode';

export interface Logger {
    info(message: string): void;
    error(message: string): void;
    warning(message: string): void;
    debug(message: string): void;
    log(message: string): void;
    appendLine(message: string): void;
    append(message: string): void;
    show(): void;
    outputChannel: vscode.OutputChannel;
}

function isString(value: any): value is string {
    return Object.prototype.toString.call(value) === '[object String]';
}

export class ConsoleLogger implements Logger {
    public outputChannel: vscode.OutputChannel;

    constructor(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    public error(message: string): void {
        this.log(message);
    }

    public info(message: string): void {
        this.log(message);
    }

    public debug(message: string): void {
        this.log(message);
    }

    public warning(message: string): void {
        this.log(message);
    }

    public log(message: string, data?: any): void {
        this.appendLine(`[Log - ${(new Date().toLocaleTimeString())}] ${message}`);
        if (data) {
            this.appendLine(ConsoleLogger.data2String(data));
        }
    }

    public appendLine(value: string = '') {
        return this.outputChannel.appendLine(value);
    }

    public append(value: string) {
        return this.outputChannel.append(value);
    }

    public show() {
        this.outputChannel.show();
    }

    private static data2String(data: any): string {
        if (data instanceof Error) {
            if (isString(data.stack)) {
                return data.stack;
            }
            return (data as Error).message;
        }
        if (isString(data)) {
            return data;
        }
        return JSON.stringify(data, undefined, 2);
    }
}
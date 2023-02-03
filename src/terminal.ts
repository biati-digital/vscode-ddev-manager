import * as vscode from 'vscode';

interface DDEVTerminal extends vscode.TerminalOptions {
    id: string,
    command: string,
}

export async function createTerminal({ id, name, message, command, cwd }: DDEVTerminal): Promise<vscode.Terminal> {
    let terminal = await vscode.window.createTerminal({
        name: name,
        message: message,
        cwd: cwd,
        hideFromUser: true,
        env: process.env
    });
    terminal.sendText(command);
    terminal.show();

    return terminal;
}

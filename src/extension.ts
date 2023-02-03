import * as vscode from 'vscode';
import { DDEVManager } from "./ddevManager";

let controller: DDEVManager;

export function activate(context: vscode.ExtensionContext) {
	controller = new DDEVManager(context);
	controller.activate();
}

export function deactivate() {
	if (controller) {
		controller.deactivate();
	}
}
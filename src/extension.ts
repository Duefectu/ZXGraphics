import * as vscode from 'vscode';
import { GDU_EditorProvider } from './GDU_Editor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(GDU_EditorProvider.register(context));
}

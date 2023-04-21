import * as vscode from 'vscode';
import { Disposable, disposeAll } from './dispose';
import { getNonce } from './util';
import { posix } from 'path';

/**
 * Define the type of edits used in paw draw files.
 */
interface GDU_EditorEdit {
	readonly color: string;
	readonly old: number;
	readonly x: number;
	readonly y: number;
	readonly pattern: number;
}


interface GDU_EditorDocumentDelegate {
	getFileData(): Promise<Uint8Array>;
}


/**
 * Define the document (the data model) used for paw draw files.
 */
class GDU_Document extends Disposable implements vscode.CustomDocument {

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
		delegate: GDU_EditorDocumentDelegate,
	): Promise<GDU_Document | PromiseLike<GDU_Document>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await GDU_Document.readFile(dataFile);
		return new GDU_Document(uri, fileData, delegate);
	}

	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	private readonly _uri: vscode.Uri;

	private _documentData: Uint8Array;
	private _edits: Array<GDU_EditorEdit> = [];
	private _savedEdits: Array<GDU_EditorEdit> = [];

	private readonly _delegate: GDU_EditorDocumentDelegate;

	private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
		delegate: GDU_EditorDocumentDelegate
	) {
		super();
		this._uri = uri;
		this._documentData = initialContent;
		this._delegate = delegate;
	}

	public get uri() { return this._uri; }

	public get documentData(): Uint8Array { return this._documentData; }

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
		readonly content?: Uint8Array;
		readonly edits: readonly GDU_EditorEdit[];
	}>());
	/**
	 * Fired to notify webviews that the document has changed.
	 */
	public readonly onDidChangeContent = this._onDidChangeDocument.event;

	private readonly _onDidChange = this._register(new vscode.EventEmitter<{
		readonly label: string,
		undo(): void,
		redo(): void,
	}>());
	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onDidChange = this._onDidChange.event;

	/**
	 * Called by VS Code when there are no more references to the document.
	 *
	 * This happens when all editors for it have been closed.
	 */
	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}

	/**
	 * Called when the user edits the document in a webview.
	 *
	 * This fires an event to notify VS Code that the document has been edited.
	 */
	makeEdit(edit: GDU_EditorEdit) {
		this._edits.push(edit);

		this._onDidChange.fire({
			label: 'Stroke',
			undo: async () => {
				this._edits.pop();
				this._onDidChangeDocument.fire({
					edits: this._edits,
				});
			},
			redo: async () => {
				this._edits.push(edit);
				this._onDidChangeDocument.fire({
					edits: this._edits,
				});
			}
		});
	}

	/**
	 * Called by VS Code when the user saves the document.
	 */
	async save(cancellation: vscode.CancellationToken): Promise<void> {
		await this.saveAs(this.uri, cancellation);
		this._savedEdits = Array.from(this._edits);
	}

	/**
	 * Called by VS Code when the user saves the document to a new location.
	 */
	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
		const fileData = await this._delegate.getFileData();
		if (cancellation.isCancellationRequested) {
			return;
		}
		await vscode.workspace.fs.writeFile(targetResource, fileData);
	}

	/**
	 * Called by VS Code when the user calls `revert` on a document.
	 */
	async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const diskContent = await GDU_Document.readFile(this.uri);
		this._documentData = diskContent;
		this._edits = this._savedEdits;
		this._onDidChangeDocument.fire({
			content: diskContent,
			edits: this._edits,
		});
	}

	/**
	 * Called by VS Code to backup the edited document.
	 *
	 * These backups are used to implement hot exit.
	 */
	async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}
}

/**
 * Provider for paw draw editors.
 *
 * Paw draw editors are used for `.pawDraw` files, which are just `.png` files with a different file extension.
 *
 * This provider demonstrates:
 *
 * - How to implement a custom editor for binary files.
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Communication between VS Code and the custom editor.
 * - Using CustomDocuments to store information that is shared between multiple custom editors.
 * - Implementing save, undo, redo, and revert.
 * - Backing up a custom editor.
 */
export class GDU_EditorProvider implements vscode.CustomEditorProvider<GDU_Document> {

	private static newGDU_EditorFileId = 1;

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		vscode.commands.registerCommand('ZXGraphics.GDU_Editor.new', () => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				vscode.window.showErrorMessage("Creating new GDU files currently requires opening a workspace");
				return;
			}

			const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, `new-${GDU_EditorProvider.newGDU_EditorFileId++}.GDU_Editor`)
				.with({ scheme: 'untitled' });

			vscode.commands.executeCommand('vscode.openWith', uri, GDU_EditorProvider.viewType);
		});

		return vscode.window.registerCustomEditorProvider(
			GDU_EditorProvider.viewType,
			new GDU_EditorProvider(context),
			{
				// For this demo extension, we enable `retainContextWhenHidden` which keeps the
				// webview alive even when it is not visible. You should avoid using this setting
				// unless is absolutely required as it does have memory overhead.
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			});
	}

	private static readonly viewType = 'ZXGraphics.GDU_Editor';

	/**
	 * Tracks all known webviews
	 */
	private readonly webviews = new WebviewCollection();

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	//#region CustomEditorProvider

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken
	): Promise<GDU_Document> {
		const document: GDU_Document = await GDU_Document.create(uri, openContext.backupId, {
			getFileData: async () => {
				const webviewsForDocument = Array.from(this.webviews.get(document.uri));
				if (!webviewsForDocument.length) {
					throw new Error('Could not find webview to save for');
				}
				const panel = webviewsForDocument[0];
				const response = await this.postMessageWithResponse<number[]>(panel, 'getFileData', {});
				return new Uint8Array(response);
			}
		});

		const listeners: vscode.Disposable[] = [];

		listeners.push(document.onDidChange(e => {
			// Tell VS Code that the document has been edited by the use.
			this._onDidChangeCustomDocument.fire({
				document,
				...e,
			});
		}));

		listeners.push(document.onDidChangeContent(e => {
			// Update all webviews when the document changes
			for (const webviewPanel of this.webviews.get(document.uri)) {
				this.postMessage(webviewPanel, 'update', {
					edits: e.edits,
					content: e.content,
				});
			}
		}));

		document.onDidDispose(() => disposeAll(listeners));

		return document;
	}

	async resolveCustomEditor(
		document: GDU_Document,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {		
		// Add the webview to our internal set of active webviews
		this.webviews.add(document.uri, webviewPanel);

		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(e => {
			if (e.type === 'ready') {
				if (document.uri.scheme === 'untitled') {
					this.postMessage(webviewPanel, 'init', {
						untitled: true,
						editable: true,
					});
				} else {
					const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);

					this.postMessage(webviewPanel, 'init', {
						value: document.documentData,
						editable,
					});
				}
			}
		});
	}

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<GDU_Document>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	public saveCustomDocument(document: GDU_Document, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.save(cancellation);
	}

	public saveCustomDocumentAs(document: GDU_Document, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.saveAs(destination, cancellation);
	}

	public revertCustomDocument(document: GDU_Document, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.revert(cancellation);
	}

	public backupCustomDocument(document: GDU_Document, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
		return document.backup(context.destination, cancellation);
	}

	//#endregion

	/**
	 * Get the static HTML used for in our editor's webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'GDU_Editor.js'));
		const scriptUri2 = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'generadorDeTAP.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'GDU_Editor.css'));
		const imagesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'images'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">			

				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>GDU_Editor</title>
			</head>
			<body>
				<div id="divSelectorColores" class="selectorColores"></div>

				<div id="modalError" class="modal">
					<div class="modalWindow">
						<div id="divLblError"></div>
						<div class="modalButtons">
							<div id="btnErrorOK" class="buttonModal bgGreen">Close</div>
						</div>
					</div>
				</div>

				<div id="modalExport" class="modal">
					<div class="modalWindow">
						<div>
							Filename
							<input id="txtExportFileName" type="text" class="input100" value="Test.tap">
						</div>
						<div class="export-TAP">
							Filename for ZX Spectrum
							<input id="txtExportZXFileName" type="text" class="input100" value="Test.bin">
						</div>
						<div class="export-TAP">
							ZX Spectrum address
							<input id="txtExportZXAddress" type="number" class="input100" value="49152">
						</div>
						<div class="export-BOR">
							Label name
							<input id="txtExportLabelName" type="text" class="input100" value="Test">
						</div>
						<div class="export-DIM">
							Variable name
							<input id="txtExportVariableName" type="text" class="input100" value="Test">
						</div>
						<div class="export-DATA">
							Line number
							<input id="txtExportLineNumber" type="numeric" class="input100" value="9000">
						</div>
						<br/>
						<div class="modalButtons">
							<div id="btnExportCancel" class="buttonModal bgRed">Cancel</div>
							<div id="btnExportExport" class="buttonModal bgGreen">Export</div>
						</div>
					</div>
				</div>

				<div id="modalNew" class="modal">
					<div id="modalNewWindow" class="modalWindow">
						<div>
							The selected file does not contain data that I can recognise.<br/>
							Do you want to discard the file's content and replace it with a new one?
						</div>
						<br/>
						<div>		
							<input id="radGDU" name="fileType" type="radio" class="radioButton" checked>
							<label for="radGDU">GDU / UDG data</label>
						</div>
						<div>		
							<input id="radFont" name="fileType" type="radio" class="radioButton">
							<label for="radFont">Font data</label>
						</div>
						<br/>
						<div class="modalButtons">
							<div id="btnNewCancel" class="buttonModal bgRed">Cancel</div>
							<div id="btnNewOK" class="buttonModal bgGreen noWidth">OK, Create new content</div>
						</div>
					</div>
				</div>

				<div id="divOpacity" class="opacity"></div>
				
				<h1>ZXGraphics - Editor</h1>
				<hr/>				
				<div id="divMain" class="main">
					<div id="divPatterns" class="patterns">
						<div id="divPatternsMain" class="patterns-main"></div>
					</div>
					<div id="divEditorMain" class="editor">
						<div id="divToolBar" class="toolBar">
							<div class="toolBarItem" style="width: 64px;">Zoom <span id="txtZoom">32x</span></div>
							<div class="toolBarItem toolBar-slider" style="width: 64px;">
								<input id="sldZoom" type="range" min=0 max=8 value=5 style="width: 100%;"/>
							</div>
							<div class="toolBarSpace"></div>
							<div class="toolBarItem">Width</div>
							<div class="toolBarItem">
								<input id="txtWidth" type="number" min=1 max=8 value=1>
							</div>
							<div class="toolBarSpace"></div>
							<div class="toolBarItem">Height</div>
							<div class="toolBarItem">
								<input id="txtHeight" type="number" min=1 max=8 value=1>
							</div>
							<div class="toolBarItem">
								<div id="btnInk" class="buttonLike">
									Ink <div id="divInk" class="colorBox"></div> &#x25bc;								
								</div>
							</div>
							<div id="btnPaper" class="toolBarItem">
								<div class="buttonLike">
									Paper <div id="divPaper" class="colorBox"></div> &#x25bc;								
								</div>
							</div>
							<div class="toolBarItem">
								<div class="buttonLike">
									Bright <span id="divBright">OFF</span>
								</div>
							</div>
							<br/>
							<div id="btnClear" class="toolBarButton" title="Clear actual pattern"><img src="${imagesUri}/Clear.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnCut" class="toolBarButton" title="Cut actual pattern"><img src="${imagesUri}/Cut.png"></div>
							<div id="btnCopy" class="toolBarButton" title="Copy actual pattern"><img src="${imagesUri}/Copy.png"></div>
							<div id="btnPaste" class="toolBarButton" title="Paste into actual pattern"><img src="${imagesUri}/Paste.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnHorizontalMirror" class="toolBarButton" title="Horizontal mirror"><img src="${imagesUri}/Horizontal Mirror.png"></div>
							<div id="btnVerticalMirror" class="toolBarButton" title="Vertical mirror"><img src="${imagesUri}/Vertical Mirror.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnRotateLeft" class="toolBarButton" title="Rotate left"><img src="${imagesUri}/Rotate Left.png"></div>
							<div id="btnRotateRight" class="toolBarButton" title="Rotate right"><img src="${imagesUri}/Rotate Right.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnShiftLeft" class="toolBarButton" title="Shift left"><img src="${imagesUri}/Shift Left.png"></div>
							<div id="btnShiftRight" class="toolBarButton" title="Shift right"><img src="${imagesUri}/Shift Right.png"></div>
							<div id="btnShiftUp" class="toolBarButton" title="Shift up"><img src="${imagesUri}/Shift Up.png"></div>
							<div id="btnShiftDown" class="toolBarButton" title="Shift down"><img src="${imagesUri}/Shift Down.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnMoveLeft" class="toolBarButton" title="Move left"><img src="${imagesUri}/Move Left.png"></div>
							<div id="btnMoveRight" class="toolBarButton" title="Move right"><img src="${imagesUri}/Move Right.png"></div>
							<div id="btnMoveUp" class="toolBarButton" title="Move up"><img src="${imagesUri}/Move Up.png"></div>
							<div id="btnMoveDown" class="toolBarButton" title="Move down"><img src="${imagesUri}/Move Down.png"></div>
							<div class="toolBarSpace"></div>
							<div id="btnInvert" class="toolBarButton" title="Invert"><img src="${imagesUri}/Invert.png"></div>
							<div id="btnMask" class="toolBarButton" title="Mask"><img src="${imagesUri}/Mask.png"></div>
							<!--
							<div class="toolBarSpace"></div>
							<div id="btnExport" class="toolBarButton" title="Export"><img src="${imagesUri}/Export.png"></div>
							<div id="btnSettings" class="toolBarButton" title="Settings"><img src="${imagesUri}/Settings.png"></div>
							-->
						</div>						
						<div id="divEditor"></div>
					</div>
					<div id="divPreview" class="preview">
						<div>
							<div class="previewLabel">First</div>
							<input id="txtFirstPattern" type="number" class="previewInput" min=0 max=255 value="0"/>
						</div>
						<div>
							<div class="previewLabel">Number</div>
							<input id="txtNumPatterns" type="number" class="previewInput" min=1 max=255 value="1"/>
						</div>
						<div>
							<div class="previewLabel">Width</div>
							<input id="txtWidthPatterns" type="number" class="previewInput" min=1 max=8 value="1"/>
						</div>
						<div>
							<div class="previewLabel">Height</div>
							<input id="txtHeightPatterns" type="number" class="previewInput" min=1 max=8 value="1"/>
						</div>
						<div>
							<div class="previewLabel">Speed</div>
							<select id="cmbSpeed">
								<option value="1000">1 fps (1000ms)</option>
								<option value="500" selected>2 fps (500ms)</option>
								<option value="250">4 fps (250ms)</option>
								<option value="200">5 fps (200ms)</option>
								<option value="125">8 fps (125ms)</option>
								<option value="100">10 fps (100ms)</option>
								<option value="66">15 fps (66ms)</option>
								<option value="50">20 fps (50ms)</option>
							</select>
						</div>
						<br/>
						<div id="divPatternPreview"></div>
						<br/>
						<hr/>
						<br/>
						<div id="btnExportTAP" class="buttonLike">Export to TAP</div>
						<br/>
						<div id="btnExportBOR" class="buttonLike">Export to Boriel ASM</div>
						<br/>
						<div id="btnExportDIM" class="buttonLike">Export to Boriel DIM</div>
						<br/>
						<div id="btnExportASM" class="buttonLike">Export to ASM</div>
						<br/>
						<div id="btnExportDATA" class="buttonLike">Export to DATA</div>
					</div>
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
				<script nonce="${nonce}" src="${scriptUri2}"></script>
			</body>
			</html>`;
	}

	private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
		const requestId = this._requestId++;
		const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
		panel.webview.postMessage({ type, requestId, body });
		return p;
	}

	private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}

	private async onMessage(document: GDU_Document, message: any) {		
		switch (message.type) {
			case 'editor_click':
				document.makeEdit(message as GDU_EditorEdit);
				return;

			case 'response':
				{
					const callback = this._callbacks.get(message.requestId);
					callback?.(message.body);
					return;
				}

			case "exportTAP":	// Expport to TAP
				{
					// Test data
					let tapFileName=message.fileName;
					let data=message.body;

					await this.ExportToBIN(tapFileName,data);
					return;
				}

			case "exportBOR":	// Expport to Boriel ASM
			case "exportDIM":	// Export to Boriel DIM
			case "exportASM":	// Expport to ASM
			case "exportDATA":	// Export to DATA			
				{
					// Test data
					let tapFileName=message.fileName;
					let data=message.body;

					await this.ExportToText(tapFileName,data);
					return;
				}

		}
	}


	/**
	 * Export data to a .TAP file
	 * @param tapFileName: Name of the PC file
	 * @param data: Array of data to save
	 */
	private async ExportToBIN(tapFileName,data){
		// Create the uri of the file
		const folderUri=vscode?.workspace.workspaceFolders?.find(x=>x!==undefined)?.uri as vscode.Uri;
		const fileUri = folderUri?.with({ path: posix.join(folderUri.path, tapFileName) });
		// Convert data to Uint8Array (it can be optimised)
		const dataParts=data.toString().split(",");
		const binData = new Array(dataParts.length);
		for(let n=0; n<dataParts.length; n++){
			binData[n]=parseInt(dataParts[n]);
			//binData.push((item:number)=>parseInt(dataParts[n]));
		}
		const dataArray=Uint8Array.from(binData);
		// Save data
		await vscode.workspace.fs.writeFile(fileUri, dataArray);
	}


	/**
	 * Export data to a .BAS file
	 * @param tapFileName: Name of the PC file
	 * @param data: Data to save
	 */
	private async ExportToText(fileName,data){
		// Create the uri of the file
		const folderUri=vscode?.workspace.workspaceFolders?.find(x=>x!==undefined)?.uri as vscode.Uri;
		const fileUri = folderUri.with({ path: posix.join(folderUri.path, fileName) });
		const binData=Uint8Array.from(data.split("").map(x => x.charCodeAt()));
		// Save data
		await vscode.workspace.fs.writeFile(fileUri, binData);
	}	
}


/**
 * Tracks all webviews.
 */
class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}



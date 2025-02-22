
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

import {getHandler} from "./external";
import { loadBase } from './external/api/ibmi';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	loadBase();

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ language: 'cl' }],
		// synchronize: {
		// 	// Notify the server about file changes to '.clientrc files contained in the workspace
		// 	fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		// }
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'vscode-clle-client',
		'CLLE Language Server',
		serverOptions,
		clientOptions
	);
5
	// Start the client. This will also launch the server
	client.start();

	client.onReady().then(() => {
		client.onRequest("getCLDefinition", async (qualifiedObject: string[]) => {
			const handler = await getHandler();
			
			if (handler) {
				const definition = await handler.getCLDefinition(qualifiedObject[0], qualifiedObject[1]);

				return definition;
			}
		});

		client.onRequest("getFileDefinition", async (qualifiedObject: string[]) => {
			const handler = await getHandler();
			
			if (handler) {
				const definition = await handler.getFileDefinition(qualifiedObject[0], qualifiedObject[1]);

				return definition;
			}
		});
	})
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

import Handler from './handler';
import * as xml2js from "xml2js";
import { getInstance } from '../api/ibmi';
import Instance from '@halcyontech/vscode-ibmi-types/api/Instance';

enum Status {
	NotChecked,
	Installed,
	NotInstalled
};

export default class vscodeIbmi extends Handler {
	static extensionId = `halcyontechltd.code-for-ibmi`;
	instance: Instance;
	installed: Status = Status.NotChecked;

	constructor() {
		super(vscodeIbmi.extensionId);
	}

	async initialise(): Promise<boolean> {
		if (this.backend) {
			const baseExtension = this.backend;
			const instance = (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.instance : null);
			if (instance) {
				this.instance = instance;
				return true;
			}
		}

		return false;
	}

	/**
	 * Returns DSPFFD outfile rows
	 */
	async getFileDefinition(objectName: string, library?: string): Promise<any> {
		if (this.hasConnection()) {
			const validLibrary = library || `*LIBL`;
			const instance = this.instance;

			const content = instance.getContent();

			/** @type {Configuration} */
			const config = instance.getConfig();

			const dateStr = Date.now().toString().substr(-6);
			const randomFile = `R${objectName.substring(0, 3)}${dateStr}`.substring(0, 10);
			const fullPath = `${config.tempLibrary}/${randomFile}`;

			const ibmi = getInstance();
			const outfileRes = await ibmi.getConnection().runCommand({
				environment: `ile`,
				command: `DSPFFD FILE(${validLibrary}/${objectName}) OUTPUT(*OUTFILE) OUTFILE(${fullPath})`
			});

			console.log(outfileRes);
			const resultCode = outfileRes.code || 0;

			if (resultCode === 0) {
				const data: object[] = await content.getTable(config.tempLibrary, randomFile, randomFile, true);

				console.log(`Temp OUTFILE read. ${data.length} rows.`);

				return data;
			}
		}

		return;
	}

	async getCLDefinition(objectName: string, library = `*LIBL`): Promise<any> {
		const canRun = await this.canGetCL();
		if (canRun) {
			try {
				const results = await this.genDefinition(objectName, library);

				return results;
			} catch (e) {
				console.log(e);
			}
		}

		return;
	}

	private async canGetCL(): Promise<boolean> {
		if (this.hasConnection() && this.installed !== Status.NotInstalled) {
			const installed = await this.checkProgramInstalled();
			return installed;
		}

		return false;
	}

	private hasConnection(): boolean {
		if (this.instance && this.instance.getConnection()) return true;
		return false;
	}

	private async checkProgramInstalled(): Promise<boolean> {
		if (this.installed === Status.Installed) return true;
		if (this.instance) {
			const connection = this.instance.getConnection();
			const config = this.instance.getConfig();
			const tempLib = config.tempLibrary;

			const checkResult = await connection.runCommand({
				command: `CHKOBJ OBJ(${tempLib}/GENCMDXML) OBJTYPE(*PGM)`,
				noLibList: true
			});

			if (checkResult.code === 0) {
				this.installed = Status.Installed;
				return true;
			}

			this.installed = Status.NotInstalled;
		}

		return false;
	}

	private async genDefinition(command, library = `*LIBL`) {
		const validLibrary = library || `*LIBL`;
		const instance = this.instance;

		/** @type {IBMi} */
		const connection = instance.getConnection();

		const content = instance.getContent();

		/** @type {Configuration} */
		const config = instance.getConfig();

		const tempLib = config.tempLibrary;

		const targetCommand = command.padEnd(10) + validLibrary.padEnd(10);
		const targetName = command.toUpperCase().padEnd(10);

		const callResult = await connection.runCommand({
			command: `CALL PGM(${tempLib}/GENCMDXML) PARM('${targetName}' '${targetCommand}')`,
		});

		if (callResult.code === 0) {
			console.log(callResult);

			const xml = await content.downloadStreamfile(`/tmp/${targetName}`);
	
			const commandData = await xml2js.parseStringPromise(xml);
	
			return commandData;
		}

		return undefined;
	}
}

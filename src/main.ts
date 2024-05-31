import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { WorkspaceLeaf } from 'obsidian';
import { Generator } from './generator';
import OpenAI from 'openai';

interface AIOutlinerSettings {
	openaiKey: string;
}

const DEFAULT_SETTINGS: AIOutlinerSettings = {
	openaiKey: 'none'
}

export const VIEW_OUTLINER = 'outliner';
export class AIOutlinerView extends MarkdownView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}
	
	getViewType() {
		return VIEW_OUTLINER;
	}

	async onOpen() {
		//return super.onOpen();
	}
}

export default class AIOutlinerPlugin extends Plugin {
	settings: AIOutlinerSettings;
	openai: OpenAI;

	async updateText(editor: Editor, view: AIOutlinerView) {
		// Ensure that I am updating an Outline.
		const active = this.app.workspace.getActiveFile();
		if (!active || active?.extension != 'outline') {
			return;
		}

		// Find md file and create if needed.
		const resfile_path = active.path.replace(/\.[^/.]+$/, ".md");
		let resfile = this.app.vault.getFileByPath(resfile_path);
		if (resfile == null) {
			resfile = await this.app.vault.create(resfile_path, '');
		}

		// Search if view already exists for md.
		let resleaf = this.app.workspace.getLeavesOfType('markdown').find((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				if (leaf.view.file && leaf.view.file.path == resfile_path) {
					return true;
				}
			}
			return false;
		});
			
		// If leaf is not opened, open md view.
		if (resleaf == null) {
			resleaf = this.app.workspace.getLeaf('split');
			resleaf.openFile(resfile, {active: false});
		} else { 
			// File already opened.
		}

		const result_editor = (resleaf.view as MarkdownView).editor;
		const generator = new Generator(this.openai);
		const result = await generator.createFile(editor.getValue(), result_editor.getValue(), (content) => {
			result_editor.setValue(content);
		});

		result_editor.setValue(result.resultContent);
		editor.setValue(result.outlineContent);
		new Notice('Done!');
	}

	async onload() {
		await this.loadSettings();

		// Register the special .outline extension.
		this.registerView(VIEW_OUTLINER, (leaf) => new AIOutlinerView(leaf));
		this.registerExtensions(['outline'], VIEW_OUTLINER);

		this.addCommand({
			id: 'ai-outliner-update',
			name: 'Update document',
			editorCallback: async (editor: Editor, view: AIOutlinerView) => {
				this.updateText(editor, view);
			}
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addRibbonIcon('bird', 'Update document', () => {
			const view = this.app.workspace.getActiveViewOfType(AIOutlinerView);
			if (view) {
				this.updateText(view?.editor, view);
			} else {
				new Notice('Could not find open outline')
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIOutlinerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		/*this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});*/

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.openai = new OpenAI({
			apiKey: this.settings.openaiKey,
			dangerouslyAllowBrowser: true,
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class AIOutlinerSettingTab extends PluginSettingTab {
	plugin: AIOutlinerPlugin;

	constructor(app: App, plugin: AIOutlinerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI Key')
			.setDesc('OpenAI API Key')
			.addText(text => text
				.setPlaceholder('Enter your key')
				.setValue(this.plugin.settings.openaiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}

import { getFrontMatterInfo } from 'obsidian';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { OpenAI } from 'openai';
import { Tree, TreeNode } from './tree';
import * as YAML from 'yaml';

export class GeneratorResult {
	resultContent: string
	outlineContent: string

	constructor(resultContent: string, outlineContent: string) {
		this.resultContent = resultContent;
		this.outlineContent = outlineContent;
	}
}

export class Generator {
	openai: OpenAI;

	constructor(openai: OpenAI) {
		this.openai = openai;
	}

	async llm(context: string, outline: string) {
		const prompt = `
Você é um escritor e revisor de texto. Seu objetivo é escrever um parágrafo a partir do outline e o texto até aquele ponto (contexto).

## Instruções

- A saída deve conter apenas o parágrafo relativo ao outline
- Escreva de forma clara e concisa

## Contexto

\`\`\`
${context}
\`\`\`

## Outline

\`\`\`
${outline}
\`\`\`
		`;

		const stream = await this.openai.chat.completions.create({
			messages: [{ role: 'user', content: prompt }],
			model: 'gpt-4o',
			stream: true,
		});
		
		let result = '';
		for await (const chunk of stream) {
			result += chunk.choices[0]?.delta?.content || '';
		}

		return result;
	}

	async createFile(outline: string, target: string, callback: (content: string) => void) {
		const outlineFront = getFrontMatterInfo(outline);
		const outlineMd = fromMarkdown(outline.slice(outlineFront.contentStart));

		const resultMd = fromMarkdown('');
		const resultFront = getFrontMatterInfo(target);
		const header = '---\n' + resultFront.frontmatter + '\n---\n';

		const frontData = YAML.parse(outlineFront.frontmatter) || {};
		const treeData = frontData?.tree ? frontData.tree : '[]';

		const oldTree = new Tree();
		oldTree.fromString(treeData);
		const newTree = new Tree();

		// Update every heading and every paragraph.
		for (const cid in outlineMd.children) {
			const outc = outlineMd.children[cid];

			if (outc.type == 'list') {
				// Treat each list as its own section
				for (const idx in outc.children) {
					const item = outc.children[idx];

					// Check if item is already generated
					let node = oldTree.get(oldTree.hash(item));
					if (!node) {
						// This node changed, compute new value
						const result = await this.llm(toMarkdown(resultMd), toMarkdown(item));
						node = new TreeNode(newTree.hash(item), item, result);
					} else {
						console.log('node exists ' + node.sha1);
					}

					newTree.push(node);
					const par = fromMarkdown(node.result).children[0];					
					resultMd.children.push(par);
					callback(header + toMarkdown(resultMd));
				}

			} else {
				resultMd.children.push(outc);
			}
		}

		// Update outliner frontmatter with metadata
		frontData['tree'] = newTree.toString();
		const outlineHeader = '---\n' + YAML.stringify(frontData) + '\n---\n';

		const resultContent = header + toMarkdown(resultMd);
		const outlineContent = outlineHeader + toMarkdown(outlineMd);
		return new GeneratorResult(resultContent, outlineContent);
	}
}

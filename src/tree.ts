import { createHash } from 'crypto';
import { toMarkdown } from 'mdast-util-to-markdown';
import { Nodes } from 'mdast-util-to-markdown/lib';

export class TreeNode {
	sha1: string;
	md: object;
	result: string;

	constructor(sha1: string, md: object, result: string) {
		this.sha1 = sha1;
		this.md = md;
		this.result = result;
	}
}

export class Tree {
	// Index in root, index if list, and hash of node.
	tree: Array<TreeNode> = [];
	hashes: Map<string, TreeNode> = new Map();

	constructor() {
	}

	hash(obj: Nodes): string {
		const shasum = createHash('sha1');
		shasum.update(toMarkdown(obj));
		const res = shasum.digest('hex');
		return res;
	}
		
	push(node: TreeNode) {
		this.tree.push(node);
		this.hashes.set(node.sha1, node);
	}

	get(sha1: string): TreeNode | undefined {
		return this.hashes.get(sha1);
	}

	toString(): string {
		return JSON.stringify(this.tree);
	}

	fromString(data: string) {
		const tree = JSON.parse(data);
		this.tree = tree;
		for (const node of tree) {
			this.hashes.set(node.sha1, node);
		}
	}
}

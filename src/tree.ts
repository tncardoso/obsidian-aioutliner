import { createHash } from 'crypto';

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

	hash(obj: object): string {
		const shasum = createHash('sha1');
		shasum.update(JSON.stringify(obj));
		return shasum.digest('hex');
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

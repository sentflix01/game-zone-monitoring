import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const repairs = [
  {
    relativePath: path.join('node_modules', '@ionic', 'utils-terminal', 'dist', 'cursor.js'),
    content: `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cursor = void 0;
const ansi_1 = require("./ansi");
class Cursor {
  static hide(stream = process.stdout) {
    if (stream && stream.isTTY) {
      stream.write((0, ansi_1.EscapeCode.cursorHide)());
    }
  }
  static show(stream = process.stdout) {
    if (stream && stream.isTTY) {
      stream.write((0, ansi_1.EscapeCode.cursorShow)());
    }
  }
}
exports.Cursor = Cursor;
`,
  },
  {
    relativePath: path.join('node_modules', '@ionic', 'utils-terminal', 'dist', 'cursor.d.ts'),
    content: `export declare class Cursor {
  static hide(stream?: NodeJS.WriteStream): void;
  static show(stream?: NodeJS.WriteStream): void;
}
`,
  },
];

for (const repair of repairs) {
  const filePath = path.resolve(workspaceRoot, repair.relativePath);
  const directory = path.dirname(filePath);

  if (!fs.existsSync(directory) || fs.existsSync(filePath)) {
    continue;
  }

  fs.writeFileSync(filePath, repair.content, 'utf8');
  console.log(`[repair-dependencies] wrote ${repair.relativePath}`);
}

const textRepairs = [
  {
    relativePath: path.join('node_modules', '@codetrix-studio', 'capacitor-google-auth', 'android', 'build.gradle'),
    apply(content) {
      return content.replaceAll('jcenter()', 'mavenCentral()');
    },
  },
];

for (const repair of textRepairs) {
  const filePath = path.resolve(workspaceRoot, repair.relativePath);

  if (!fs.existsSync(filePath)) {
    continue;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  const next = repair.apply(current);

  if (next === current) {
    continue;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`[repair-dependencies] patched ${repair.relativePath}`);
}

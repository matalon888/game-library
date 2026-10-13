import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
const target = process.argv[2] || 'All';
fs.mkdirSync(dist, { recursive: true });
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function collect(directory, prefix = '', exclude = new Set()) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (exclude.has(entry.name) || entry.isSymbolicLink()) return [];
    const relative = prefix + entry.name;
    if (entry.isDirectory()) return collect(path.join(directory, entry.name), relative + '/', exclude);
    return [{ name: relative, data: fs.readFileSync(path.join(directory, entry.name)) }];
  });
}
function zip(entries, destination) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), packed = deflateRawSync(entry.data), crc = crc32(entry.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8); record.writeUInt16LE(8, 10); record.writeUInt16LE(33, 14);
    record.writeUInt32LE(crc, 16); record.writeUInt32LE(packed.length, 20);
    record.writeUInt32LE(entry.data.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    local.push(header, name, packed); central.push(record, name);
    offset += header.length + name.length + packed.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  const data = Buffer.concat([...local, index, end]);
  fs.writeFileSync(destination, data);
  console.log(`${path.relative(root, destination)}: ${entries.length} files, ${data.length} bytes`);
  fs.writeFileSync(destination + '.sha256', `${createHash('sha256').update(data).digest('hex')}  ${path.basename(destination)}\n`);
}
if (target === 'All' || target === 'Web') {
  const web = path.join(dist, 'web');
  if (path.resolve(web) !== path.join(root, 'dist', 'web')) throw new Error('Unsafe web output path');
  fs.rmSync(web, { recursive: true, force: true });
  fs.mkdirSync(web, { recursive: true });
  fs.copyFileSync(path.join(root, 'index.html'), path.join(web, 'index.html'));
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(root, name), path.join(web, name));
  fs.cpSync(path.join(root, 'src'), path.join(web, 'src'), { recursive: true });
  zip(collect(web), path.join(dist, `Raincoil-${version}-itch-web.zip`));
}
if (target === 'All' || target === 'Source') {
  const files = ['.gitignore', '.gitattributes', 'AGENTS.md', 'Build.ps1', 'README.md',
    'LICENSE', 'THIRD_PARTY_NOTICES.md', 'index.html', 'package.json', 'package-lock.json'];
  const entries = files.map(name => ({name, data:fs.readFileSync(path.join(root,name))}));
  // Explicit source roots prevent local captures, secrets, caches and handoffs leaking into exports.
  for (const directory of ['src', 'desktop', 'docs', 'tests', 'tools']) {
    entries.push(...collect(path.join(root,directory),directory+'/',
      new Set(['icon.ico','CHECKPOINT.md','evidence','node_modules','.cache'])));
  }
  zip(entries, path.join(dist, `Raincoil-${version}-source.zip`));
}

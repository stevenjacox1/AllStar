import { marked } from 'marked';

let markdown = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  markdown += chunk;
});

process.stdin.on('end', () => {
  const html = marked.parse(markdown);
  process.stdout.write(typeof html === 'string' ? html : String(html));
});

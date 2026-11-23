import fs from 'node:fs';

const read = (f) => fs.readFileSync(f, 'utf8');
const count = (s, re) => (s.match(re) || []).length;

const app = read('src/App.tsx');
console.log('App.tsx lines:', app.split('\n').length);
console.log('ROOM_A101 references in App.tsx:', count(app, /ROOM_A101/g));

for (const dir of ['src/data', 'src/lib', 'src/components']) {
  for (const f of fs.readdirSync(dir)) {
    console.log(dir + '/' + f, read(dir + '/' + f).split('\n').length, 'lines');
  }
}

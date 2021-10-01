import fs from 'fs';

export const readJSONFile = <T extends object>(file: string): T =>
  JSON.parse(fs.readFileSync(file, 'utf8'));

export const saveJSONFile = <T extends object>(file: string, data: T) =>
  fs.writeFileSync(file, JSON.stringify(data, undefined, 2), 'utf8');

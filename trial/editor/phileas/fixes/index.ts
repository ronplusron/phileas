import { defineFixes } from '@drugstoresushi/phileas';
import { newDocument } from './new-document';

/**
 * Bobolink Editor's Fixes, by the name a Journey or `phileas run --fix`
 * chooses them by. `new-document` opens a second document with markdown in
 * it. `--fix none`, or no `--fix`, starts wherever the editor starts, which on
 * a first run is its welcome note.
 */
export const fixes = defineFixes({
  'new-document': newDocument,
});

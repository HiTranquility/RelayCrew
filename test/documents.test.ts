import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {documentText} from '../src/storage/document-text';
import {attachmentContent} from '../src/storage/attachments';
test('DOCX and ODT import bounded text without following relationships or entities',()=>{
 const doc=Buffer.from(zipSync({'word/document.xml':strToU8('<w:document><w:p><w:t>Hello &amp; owner</w:t></w:p></w:document>'),'word/_rels/document.xml.rels':strToU8('https://never-fetch.test')}));
 assert.equal(documentText('brief.docx',doc)?.data.toString(),'Hello & owner');assert.equal(documentText('brief.docx',doc)?.name,'brief.docx.txt');
 const odt=Buffer.from(zipSync({'content.xml':strToU8('<text:p>First</text:p><text:p>Second</text:p>')}));assert.equal(documentText('notes.odt',odt)?.data.toString(),'First\nSecond');
 assert.throws(()=>documentText('a.docx',Buffer.from('not a document')));
 assert.throws(()=>documentText('a.docx',Buffer.from(zipSync({'word/document.xml':strToU8('<!ENTITY bad "never"><w:p>x</w:p>')}))));
 assert.throws(()=>documentText('a.docx',Buffer.from(zipSync({'word/document.xml':new Uint8Array(1024*1024+1)}))));
 assert.equal(documentText('a.md',Buffer.from('unchanged')),undefined);
});
test('new binary formats are classified from magic bytes rather than the supplied extension',()=>{
 assert.equal(attachmentContent('a.pdf',Buffer.from('%PDF-1.7\nfixture')).mime,'application/pdf');
 assert.equal(attachmentContent('a.webp',Buffer.from('RIFF1234WEBPfixture')).mime,'image/webp');
 assert.equal(attachmentContent('a.gif',Buffer.from('GIF89afixture')).mime,'image/gif');
 assert.throws(()=>attachmentContent('a.webp',Buffer.from('not an image')));
});

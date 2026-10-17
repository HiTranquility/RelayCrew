import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLayout, paneBounds } from '../src/core/layout';
test('layout imports clamp geometry, reject nonnumeric values and discard unknown properties',()=>{
  assert.deepEqual(normalizeLayout(null),normalizeLayout({}));
  assert.deepEqual(normalizeLayout({sidebarWidth:999,composerPercent:-1,textPercent:Infinity,density:'compact',secret:'never'}),{composerPosition:'bottom',mapPosition:'right',sidebarWidth:420,composerPercent:20,textPercent:100,density:'compact',contentWidth:'fluid'});
  assert.equal(paneBounds(420,700).narrow,true);
  assert.ok(paneBounds(900,700).maxSidebar<=900-360);
  assert.equal(normalizeLayout({textPercent:125}).textPercent,125);
  for(const position of ['left','right','top','bottom','float']){assert.equal(normalizeLayout({mapPosition:position,composerPosition:position}).mapPosition,position);assert.equal(normalizeLayout({composerPosition:position}).composerPosition,position);}
  assert.equal(normalizeLayout({mapPosition:'invalid'}).mapPosition,'right');
});

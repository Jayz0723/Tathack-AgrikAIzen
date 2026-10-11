const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(pages, current) {
  const handlers = {}, properties = {}, classes = new Set(), calls = [];
  const buttons = pages.map(page => {
    const selected = new Set(page === current ? ['active'] : []);
    return {dataset:{page}, attributes:{}, classList:{toggle(c, on){on ? selected.add(c) : selected.delete(c)},contains(c){return selected.has(c)}},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}};
  });
  const bar = {dataset:{}, style:{setProperty(k,v){properties[k]=v}},classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},toggle(c,on){on ? classes.add(c) : classes.delete(c)}},querySelectorAll(){return buttons},getBoundingClientRect(){return {left:0,width:512}},setPointerCapture(){},addEventListener(k,fn){handlers[k]=fn}};
  const documentHandlers = {};
  const state = {page:current};
  const context = vm.createContext({document:{querySelector(){return bar},addEventListener(k,fn){documentHandlers[k]=fn}},state,Date,go(page){calls.push(page);state.page=page}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/navigation.js'),'utf8'),context);
  vm.runInContext('bindNavigationSwipe()',context);
  const send = (type,x,y=20,extra={}) => handlers[type]({pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,preventDefault(){},...extra});
  return {buttons,properties,classes,calls,send,documentHandlers};
}

test('drag previews the tab under the finger and switches only on release',()=>{
  const f=fixture(['home','buyers','estimate','community','profile'],'home');
  assert.equal(f.buttons[0].attributes['aria-current'],'page');
  f.send('pointerdown',40);f.send('pointermove',250);
  assert.equal(f.properties['--nav-index'],2);
  assert.ok(f.buttons[2].classList.contains('active'));
  assert.deepEqual(f.calls,[]);
  f.send('pointerup',250);
  assert.deepEqual(f.calls,['estimate']);
  let prevented=false,stopped=false;
  f.documentHandlers.click({target:{closest(){return {}}},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
  assert.ok(prevented && stopped,'synthetic click must not activate the starting tab');
});

test('taps, small movements, vertical gestures and cancellation do not switch tabs',()=>{
  for(const action of ['tap','small','vertical','cancel']){
    const f=fixture(['home','buyers','estimate','community','profile'],'buyers');
    f.send('pointerdown',150);
    if(action==='small')f.send('pointermove',155);
    if(action==='vertical')f.send('pointermove',153,80);
    if(action==='cancel')f.send('pointermove',450);
    f.send(action==='cancel'?'pointercancel':'pointerup',450);
    assert.deepEqual(f.calls,[],action);
    assert.ok(f.buttons[1].classList.contains('active'),action);
  }
});

test('swiping works with four tabs and keeps gestures inside the end tabs',()=>{
  const f=fixture(['home','logistics','community','profile'],'home');
  assert.equal(f.properties['--nav-count'],4);
  f.send('pointerdown',40);f.send('pointermove',900);
  assert.equal(f.properties['--nav-index'],3);
  f.send('pointerup',900);assert.deepEqual(f.calls,['profile']);
  const g=fixture(['home','buyers','estimate','community','profile'],'profile');
  g.send('pointerdown',460);g.send('pointermove',-200);g.send('pointerup',-200);
  assert.deepEqual(g.calls,['home']);
});

test('secondary pointers do not steal a navigation gesture',()=>{
  const f=fixture(['home','buyers','estimate','community','profile'],'home');
  f.send('pointerdown',40);f.send('pointermove',450,20,{pointerId:2});f.send('pointerup',450,20,{pointerId:2});
  assert.deepEqual(f.calls,[]);
  f.send('pointermove',150);f.send('pointerup',150);assert.deepEqual(f.calls,['buyers']);
});

const assert=require('node:assert/strict');
const saves=require('./saves.js');
const q={title:'Тест',start:'a',variables:[{id:'s',type:'stat',name:'Сила',initial:1},{id:'i',type:'item',name:'Ключ',initial:0},{id:'f',type:'flag',name:'Флаг',initial:false}],scenes:[{id:'a',title:'Начало',text:'Текст',x:20,choices:[{text:'Дальше',target:'b'}]},{id:'b',title:'Финал',text:'Конец',choices:[]}]};
const state={s:4,i:2,f:true},save=saves.make(q,'b',state);
state.i=99;assert.equal(save.state.i,2,'snapshot is independent');
const restored=saves.validate(q,JSON.parse(JSON.stringify(save)));
assert.equal(restored.scene,'b');assert.deepEqual(restored.state,{s:4,i:2,f:true});
const moved=structuredClone(q);moved.scenes[0].x=900;
assert.equal(saves.questKey(moved),saves.questKey(q),'moving graph does not invalidate saves');
const exported=structuredClone(q);delete exported.scenes[0].x;Object.assign(exported.scenes[0].choices[0],{zone:[],conditions:[],conditionMode:'all',effects:[]});
assert.equal(saves.questKey(exported),saves.questKey(q),'preview and HTML identities match');
const changed=structuredClone(q);changed.scenes[0].choices[0].effects=[{variable:'i',op:'add',value:1}];
assert.throws(()=>saves.validate(changed,save),/версии/);
for(const bad of [null,{}, {...save,version:2},{...save,scene:'missing'},{...save,savedAt:'oops'},{...save,state:{s:4,i:-1,f:true}},{...save,state:{s:4,i:1.5,f:true}},{...save,state:{s:Infinity,i:1,f:true}},{...save,state:{s:4,i:1,f:'true'}},{...save,state:{s:4,i:1}},{...save,state:{...save.state,extra:3}}])assert.throws(()=>saves.validate(q,bad));
console.log('PASS: save snapshots, state validation, cross-format identity, graph movement, incompatible revisions');

// Exercise shared controls with storage failures, file imports and disposed sessions.
(async()=>{
  const vm=require('node:vm');
  class Element{constructor(){this.children=[];this.value='';this.textContent='';}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(){} }
  const db=new Map();let denied=false,current={scene:'a',state:{s:1,i:0,f:false}},loads=0;
  const ctx={document:{createElement:()=>new Element()},localStorage:{getItem:k=>{if(denied)throw Error('Denied');return db.get(k)||null;},setItem:(k,v)=>{if(denied)throw Error('Quota');db.set(k,v);}}};
  vm.runInNewContext(saves.standaloneSource(),ctx);
  const host=new Element(),controller=ctx.QuestSaves.attach({host,quest:q,getState:()=>current,onLoad:s=>{current=s;loads++;}});
  const [summary,bar,status]=host.children[0].children;
  const [slot,saveButton,loadButton,download,upload,file]=bar.children;
  saveButton.onclick();current={scene:'b',state:{s:4,i:2,f:true}};controller.autosave();
  slot.value='1';loadButton.onclick();assert.equal(current.scene,'a');
  slot.value='auto';slot.onchange();loadButton.onclick();assert.equal(current.scene,'b');assert.equal(current.state.i,2);
  file.files=[{size:100,text:async()=>JSON.stringify(save)}];await file.onchange();assert.equal(current.scene,'b');
  const previousLoads=loads;file.files=[{size:100,text:async()=>JSON.stringify({...save,state:{s:0,i:-1,f:false}})}];await file.onchange();assert.equal(loads,previousLoads,'bad file never calls restore');
  file.files=[{size:2*1024*1024,text:async()=>{throw Error('must not read');}}];await file.onchange();assert.ok(status.textContent.includes('1 МБ'));
  denied=true;controller.autosave();assert.ok(status.textContent.includes('Не удалось сохранить'));assert.equal(current.scene,'b');
  controller.refresh();assert.equal(loadButton.disabled,true);
  denied=false;controller.dispose();file.files=[{size:100,text:async()=>JSON.stringify(save)}];await file.onchange();assert.equal(loads,previousLoads,'old asynchronous session cannot restore into a new one');
  console.log('PASS: manual slots, autosave, portable import, rejected imports, oversized files, unavailable storage, disposed sessions');
})().catch(error=>{console.error(error);process.exitCode=1;});

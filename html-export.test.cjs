const assert=require('node:assert/strict');
const vm=require('node:vm');
const exporter=require('./html-export.js');
const project={version:1,title:'Квест <тест> "&" </title><script>bad()</script>',start:'start',variables:[{id:'key',name:'Ключ',type:'item',initial:0},{id:'flag',name:'Дверь',type:'flag',initial:false}],scenes:[
  {id:'start',title:'Начало',text:'</script><script>bad()</script> & <img src=x onerror=bad()>',x:20,y:40,choices:[{text:'Взять ключ',target:'door',effects:[{variable:'key',op:'add',value:1},{variable:'flag',op:'set',value:true}],zone:[{mode:'paint',radius:.1,points:[[.5,.5]]}]}]},
  {id:'door',title:'Дверь',text:'Условия и последствия',choices:[{text:'Открыть дверь',target:'end',conditions:[{variable:'key',op:'gte',value:1},{variable:'flag',op:'eq',value:true}],effects:[{variable:'key',op:'add',value:-1}]}]},
  {id:'end',title:'Финал',text:'Конец истории',choices:[]}
]};
const html=exporter.build(project);
assert.equal((html.match(/<script\b/g)||[]).length,2,'text cannot inject script tags');
assert.ok(html.includes('&lt;тест&gt;'));
assert.ok(!/<script[^>]+src=|<link\b|@import|fetch\(/i.test(html),'no external runtime dependencies');
assert.ok(!html.includes('contenteditable'),'no editor controls');
const data=JSON.parse(html.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.scenes[0].text,project.scenes[0].text,'text survives safe serialization');
assert.equal(data.scenes[0].x,undefined,'editor coordinates are not exported');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
// Run the exact generated script against a minimal DOM and exercise real player callbacks.
class Element {
  constructor(){this.children=[];this.style={};this.hidden=false;this.checked=false;this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  removeAttribute(name){delete this[name];}
  focus(){}
  setAttribute(name,value){this[name]=value;}
  getContext(){return {clearRect(){}};}
  getBoundingClientRect(){return {left:100,top:100,width:1000,height:500};}
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
get('quest-data').textContent=JSON.stringify(data);
const storage=new Map();
const context={document:{getElementById:get,createElement:()=>new Element()},window:{scrollTo(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
vm.runInNewContext(source,context);
assert.equal(get('scene-title').textContent,'Начало');
assert.equal(get('scene-text').textContent,project.scenes[0].text,'markup is rendered as literal text');
get('choices').children.find(e=>e.onclick).onclick();
assert.equal(get('scene-title').textContent,'Дверь');
const saveBar=get('game-saves').children[0].children[1];
const [slot,saveGame,loadGame]=saveBar.children;
saveGame.onclick();
assert.equal(get('choices').children.find(e=>e.onclick).disabled,false,'award unlocks following choice');
get('choices').children.find(e=>e.onclick).onclick();
assert.equal(get('scene-title').textContent,'Финал');
assert.equal(get('ending').hidden,false);
loadGame.onclick();assert.equal(get('scene-title').textContent,'Дверь','manual save restores scene and inventory without repeating effects');
get('choices').children.find(e=>e.onclick).onclick();assert.equal(get('scene-title').textContent,'Финал');
get('restart').onclick();assert.equal(get('restart-confirm').hidden,false);
get('cancel-restart').onclick();assert.equal(get('scene-title').textContent,'Финал');
get('restart').onclick();get('confirm-restart').onclick();
assert.equal(get('scene-title').textContent,'Начало');
slot.value='auto';slot.onchange();loadGame.onclick();
assert.equal(get('scene-title').textContent,'Финал','restart preserves autosave');
get('confirm-restart').onclick();
// Use the generated player's zone handler, not a separate imitation of its logic.
get('image').naturalWidth=1000;get('image').naturalHeight=500;get('image').onload();
get('zones').onclick({clientX:110,clientY:110});
assert.equal(get('scene-title').textContent,'Начало','empty image area does not advance');
get('zones').onclick({clientX:600,clientY:350});
assert.equal(get('scene-title').textContent,'Дверь','painted area follows the same reward path');
assert.equal(get('choices').children.find(e=>e.onclick).disabled,false,'zone applies item and flag effects');
const blockedData=JSON.parse(JSON.stringify(data));
blockedData.scenes[0].choices[0].conditions=[{variable:'key',op:'gte',value:1}];
elements.clear();get('quest-data').textContent=JSON.stringify(blockedData);
vm.runInNewContext(source,context);
assert.equal(get('choices').children.find(e=>e.onclick).disabled,true);
get('image').naturalWidth=1000;get('image').naturalHeight=500;get('image').onload();
get('zones').onclick({clientX:600,clientY:350});
assert.equal(get('scene-title').textContent,'Начало','locked zone cannot bypass conditions');
const broken=JSON.parse(JSON.stringify(project));broken.scenes[0].choices[0].target='missing';
assert.throws(()=>exporter.build(broken));
const layered=structuredClone(project);layered.characters=[{id:'hero',name:'Герой',image:'data:image/png;base64,aGVsbG8='}];
layered.scenes[0].image=layered.characters[0].image;layered.scenes[0].actors=[{character:'hero',x:.5,y:.9,width:.25}];
layered.scenes[0].choices[0].check={targets:['','end','end','end','end'],failureTarget:'door'};
const layeredHTML=exporter.build(layered),layeredData=JSON.parse(layeredHTML.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const layeredSource=layeredHTML.match(/<script>([\s\S]*?)<\/script>/)[1];
elements.clear();get('quest-data').textContent=JSON.stringify(layeredData);context.Math=Object.create(Math);context.Math.random=()=>0;
vm.runInNewContext(layeredSource,context);
assert.equal(get('choices').children.length,0,'painted paths are not duplicated below the image');
assert.equal(get('actors').children[0].alt,'Герой');
get('image-paths').children[0].onclick();
assert.equal(get('scene-title').textContent,'Дверь','empty D20 band enters failure scene');
assert.equal(get('choices').children.find(e=>e.onclick).disabled,true,'failure grants neither item nor flag');
assert.match(get('roll-result').textContent,/Провал/);
get('confirm-restart').onclick();context.Math.random=()=>.999;get('image-paths').children[0].onclick();
assert.equal(get('scene-title').textContent,'Финал');assert.match(get('roll-result').textContent,/Крит/);
console.log('PASS: standalone HTML, escaped content, shared runtime, effects, conditions, zones, blocked zones, final scene, restart, invalid targets');
console.log('PASS: exported character layers, image-only paths, D20 failure and critical branches');
module.exports={project};

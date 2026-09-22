const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rules=require('./rules.js'),layers=require('./scene-layers.js'),saves=require('./saves.js'),html=require('./html-export.js');
const variables=[{id:'gold',name:'Золото',type:'item',initial:0}];
const choice={text:'Бросок',target:'success',check:{targets:['low','','mid','','crit'],failureTarget:'failure'},effects:[{variable:'gold',op:'add',value:2}]};
rules.validateChoice(choice,variables);
for(let value=1;value<=20;value++){
  const result=rules.resolve(choice,variables,{gold:0},()=> (value-.5)/20);
  assert.equal(result.roll.value,value);
  const target=value<=5?'low':value<=10?'failure':value<=15?'mid':value<=17?'failure':'crit';
  assert.equal(result.target,target);assert.equal(result.state.gold,target==='failure'?0:2);
}
const blocked={...choice,conditions:[{variable:'gold',op:'gte',value:1}]};
assert.equal(rules.resolve(blocked,variables,{gold:0},()=>{throw Error('Must not roll while locked');}).ok,false);
const empty={...choice,check:{targets:['','','','',''],failureTarget:'failure'}};
assert.equal(rules.resolve(empty,variables,{gold:0},()=>.999).target,'failure');
assert.throws(()=>rules.validateChoice({...choice,check:{targets:[],failureTarget:'failure'}},variables));
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const project={version:1,title:'Проверка слоёв',start:'low',variables,characters:[{id:'actor',name:'Путник',image}],scenes:['low','mid','crit','failure','success'].map(id=>({id,title:id,text:'',x:0,y:0,choices:[]}))};
project.scenes[0].image=image;project.scenes[0].actors=[{character:'actor',x:.5,y:.9,width:.3}];project.scenes[0].choices=[choice];
layers.validate(project);
assert.throws(()=>layers.validate({...project,characters:[]}));
const bad=structuredClone(project);bad.scenes[0].actors[0].width=-1;assert.throws(()=>layers.validate(bad));
const exported=html.build(project),data=JSON.parse(exported.match(/<script id="quest-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(data.characters,project.characters);assert.deepEqual(data.scenes[0].actors,project.scenes[0].actors);assert.deepEqual(data.scenes[0].choices[0].check,choice.check);
assert.equal(saves.questKey(project),saves.questKey(data));
const edited=structuredClone(project);edited.scenes[0].choices[0].check.failureTarget='crit';assert.notEqual(saves.questKey(project),saves.questKey(edited));
const elements=new Map();class Element{constructor(){this.children=[];this.style={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this[k]=v;}}
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const context={document:{createElement:()=>new Element()},module:{exports:{}}};vm.runInNewContext(layers.standaloneSource(),context);
const layerAPI=context.module.exports,host=new Element();layerAPI.actors(host,project.scenes[0],project.characters);
assert.equal(host.children.length,1);assert.equal(host.children[0].style.left,'50%');assert.equal(host.children[0].alt,'Путник');
const zoned={...project.scenes[0],choices:[{text:'Идти',target:'mid',zone:[{mode:'paint',radius:.1,points:[[.3,.4]]}]}]};
let taken;layerAPI.paths(host,zoned,project.scenes,()=>({ok:true}),c=>{taken=c;});assert.equal(host.children[0].textContent,'→ mid');host.children[0].onclick();assert.equal(taken,zoned.choices[0]);
// Exercise the actual graph operations with isolated project data.
const graphSource=fs.readFileSync('graph-editor.js','utf8').split("const undoDisconnect=")[0];
const graphContext={matchMedia:()=>({}),el:()=>new Element(),document:{querySelector:()=>new Element()},$:get,QuestRules:rules,project:structuredClone(project),selected:'low',save(){},render(){},renderGraph(){}};
vm.runInNewContext(graphSource+'\nthis.removeScene=deleteScene;this.restoreScene=()=>undoScene.onclick();this.reorder=moveScene;',graphContext);
const original=JSON.stringify(graphContext.project);graphContext.removeScene('low');assert.equal(graphContext.project.scenes.length,4);graphContext.restoreScene();assert.equal(JSON.stringify(graphContext.project),original);
graphContext.removeScene('failure');assert.equal(graphContext.project.scenes[0].choices.length,0);graphContext.restoreScene();assert.equal(JSON.stringify(graphContext.project),original);
graphContext.reorder('crit','low');assert.equal(graphContext.project.scenes[0].id,'crit');assert.equal(graphContext.project.start,'low');
console.log('PASS: all D20 faces, boundaries, empty bands fail, success-only effects, blocked rolls, layers, HTML round trip, save identity, scene deletion/undo, ordering');

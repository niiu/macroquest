const assert=require('node:assert/strict');
const rules=require('./rules.js');
const variables=[{id:'strength',name:'Сила',type:'stat',initial:5},{id:'key',name:'Ключ',type:'item',initial:1},{id:'door',name:'Дверь открыта',type:'flag',initial:false}];
rules.validateVariables(variables);
const state=rules.initialState(variables);
const choice={conditionMode:'all',conditions:[{variable:'strength',op:'gte',value:5},{variable:'key',op:'gte',value:1},{variable:'door',op:'eq',value:true}]};
rules.validateChoice(choice,variables);
assert.equal(rules.allowed(choice,variables,state),false,'all requires every condition');
state.door=true;assert.equal(rules.allowed(choice,variables,state),true,'all pass');
state.key=0;assert.equal(rules.allowed(choice,variables,state),false,'missing item blocks');
choice.conditionMode='any';assert.equal(rules.allowed(choice,variables,state),true,'any allows one passing condition');
state.strength=0;state.door=false;assert.equal(rules.allowed(choice,variables,state),false,'any fails if none pass');
assert.equal(rules.allowed({},variables,state),true,'legacy paths remain available');
assert.equal(rules.allowed({conditionMode:'any',conditions:[]},variables,state),true,'no requirements means available');
assert.equal(rules.allowed({conditions:[{variable:'missing',op:'eq',value:0}]},variables,state),false,'missing variable fails closed');
assert.equal(rules.allowed({conditions:[{variable:'strength',op:'gte',value:0}]},variables,{}),false,'missing state fails closed');
assert.equal(rules.allowed({conditions:[{variable:'door',op:'ne',value:true}]},variables,state),true,'negative flag condition');
for(const [op,value,expected] of [['gt',5,false],['gte',5,true],['eq',5,true],['ne',5,false],['lt',6,true],['lte',4,false]]){
  assert.equal(rules.allowed({conditions:[{variable:'strength',op,value}]},variables,{...state,strength:5}),expected,op);
}
assert.throws(()=>rules.validateChoice({conditions:[{variable:'key',op:'gte',value:-1}]},variables));
assert.throws(()=>rules.validateChoice({conditions:[{variable:'key',op:'gte',value:1.5}]},variables));
assert.throws(()=>rules.validateChoice({conditions:[{variable:'door',op:'gt',value:true}]},variables));
assert.throws(()=>rules.validateChoice({conditions:[{variable:'door',op:'eq',value:'true'}]},variables));
assert.throws(()=>rules.validateChoice({conditions:[{variable:'strength',op:'gte',value:NaN}]},variables));
assert.throws(()=>rules.validateVariables([...variables,variables[0]]));
assert.throws(()=>rules.validateVariables([{id:'x',type:'item',name:'Монета',initial:-1}]));
const restored=JSON.parse(JSON.stringify({variables,choice}));
rules.validateVariables(restored.variables);rules.validateChoice(restored.choice,restored.variables);
assert.equal(rules.allowed(restored.choice,restored.variables,rules.initialState(restored.variables)),true,'round trip preserves any-mode semantics');
assert.equal(rules.initialState(variables).key,1,'restarting resets inventory');
assert.equal(variables[2].initial,false,'play state never changes project defaults');
console.log('PASS: stat operators, inventory counts, boolean flags, all/any, legacy paths, validation, round trip, restart');

// Effects are ordered, atomic, and never mutate the state during availability checks.
const reward={effects:[{variable:'strength',op:'add',value:2},{variable:'key',op:'add',value:1},{variable:'door',op:'set',value:true}]};
rules.validateChoice(reward,variables);
const before=rules.initialState(variables),awarded=rules.transition(reward,variables,before);
assert.equal(awarded.ok,true);
assert.deepEqual(awarded.state,{strength:7,key:2,door:true});
assert.deepEqual(before,{strength:5,key:1,door:false});
assert.deepEqual(rules.transition(reward,variables,before).state,awarded.state,'availability checks do not apply effects');
assert.equal(rules.transition(reward,variables,awarded.state).state.key,3,'repeated transition awards again');
const spend={effects:[{variable:'strength',op:'add',value:5},{variable:'key',op:'add',value:-2}]};
assert.equal(rules.transition(spend,variables,before).ok,false,'insufficient items block the entire transition');
assert.equal(before.strength,5,'failed effect cannot partially update state');
assert.equal(rules.transition(spend,variables,awarded.state).state.key,0);
assert.equal(rules.transition({effects:[{variable:'key',op:'set',value:0},{variable:'key',op:'add',value:3}]},variables,before).state.key,3,'effects follow listed order');
assert.equal(rules.transition({effects:[{variable:'door',op:'toggle'}]},variables,before).state.door,true);
assert.equal(rules.transition({effects:[{variable:'door',op:'set',value:false}]},variables,awarded.state).state.door,false);
assert.equal(rules.transition({conditions:[{variable:'door',op:'eq',value:true}],...reward},variables,before).ok,false,'conditions run before effects');
assert.equal(rules.transition({effects:[{variable:'strength',op:'add',value:Number.MAX_VALUE}]},variables,{...before,strength:Number.MAX_VALUE}).ok,false,'overflow is blocked');
for(const effect of [{variable:'missing',op:'add',value:1},{variable:'key',op:'set',value:-1},{variable:'key',op:'add',value:.5},{variable:'door',op:'add',value:1},{variable:'strength',op:'toggle'},{variable:'strength',op:'set',value:NaN}]){
  assert.throws(()=>rules.validateChoice({effects:[effect]},variables));
}
const restoredReward=JSON.parse(JSON.stringify(reward));
assert.deepEqual(rules.transition(restoredReward,variables,before).state,awarded.state);
console.log('PASS: rewards, spending, set/add/toggle, ordered atomic effects, condition precedence, overflow, repeat, validation, round trip');

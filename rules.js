/* Serializable quest parameters and transition requirements, shared with the player. */
(function installQuestRules(root){
  'use strict';
  const types={stat:'Характеристика',item:'Предмет',flag:'Флаг'};
  const operators={gte:'≥',gt:'>',eq:'=',ne:'≠',lte:'≤',lt:'<'};
  const compare=(a,op,b)=>({gte:()=>a>=b,gt:()=>a>b,eq:()=>a===b,ne:()=>a!==b,lte:()=>a<=b,lt:()=>a<b}[op]?.()??false);
  function validValue(v,value){return v.type==='flag'?typeof value==='boolean':Number.isFinite(value)&&(v.type!=='item'||Number.isInteger(value)&&value>=0);}
  function validateVariables(variables){
    if(!Array.isArray(variables)||variables.length>200)throw Error('Допускается до 200 параметров квеста.');
    const ids=new Set();
    for(const v of variables){
      if(!v||typeof v.id!=='string'||!v.id||ids.has(v.id)||!Object.hasOwn(types,v.type)||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||!validValue(v,v.initial))throw Error('Некорректный параметр квеста.');
      ids.add(v.id);
    }
  }
  function validateChoice(choice,variables){
    if(choice.check!==undefined&&choice.check!==null){
      if(!Array.isArray(choice.check.targets)||choice.check.targets.length!==5||choice.check.targets.some(t=>typeof t!=='string')||typeof choice.check.failureTarget!=='string')throw Error('Укажите пять выходов проверки D20 и сцену провала (допускаются пустые пороги).');
    }
    if(choice.conditionMode!==undefined&&!['all','any'].includes(choice.conditionMode))throw Error('Некорректный режим условий.');
    if(choice.conditions!==undefined&&(!Array.isArray(choice.conditions)||choice.conditions.length>100))throw Error('Допускается до 100 условий на путь.');
    for(const rule of choice.conditions||[]){
      const v=variables.find(v=>v.id===rule?.variable);
      if(!v||!Object.hasOwn(operators,rule.op)||!validValue(v,rule.value)||(v.type==='flag'&&!['eq','ne'].includes(rule.op)))throw Error('Условие ссылается на отсутствующий параметр или содержит неверное значение.');
    }
    validateEffects(choice.effects,variables);
  }
  function validateEffects(effects,variables){
    if(effects===undefined)return;
    if(!Array.isArray(effects)||effects.length>100)throw Error('Допускается до 100 последствий на путь.');
    for(const effect of effects){
      const v=variables.find(v=>v.id===effect?.variable);
      if(!v)throw Error('Последствие ссылается на отсутствующий параметр.');
      const valid=v.type==='flag'
        ? effect.op==='toggle'||effect.op==='set'&&typeof effect.value==='boolean'
        : ['add','set'].includes(effect.op)&&Number.isFinite(effect.value)&&(v.type!=='item'||Number.isInteger(effect.value)&&(effect.op==='add'||effect.value>=0));
      if(!valid)throw Error('Некорректная операция или значение последствия.');
    }
  }
  function transition(choice,variables,state){
    if(!allowed(choice,variables,state))return {ok:false,reason:'Нужно: '+summary(choice,variables)};
    try{validateEffects(choice.effects,variables);}catch(e){return {ok:false,reason:e.message};}
    const next={...state};
    for(const effect of choice.effects||[]){
      const v=variables.find(v=>v.id===effect.variable);
      if(!Object.hasOwn(next,v.id)||!validValue(v,next[v.id]))return {ok:false,reason:'Некорректное состояние: '+v.name};
      const value=effect.op==='toggle'?!next[v.id]:effect.op==='add'?next[v.id]+effect.value:effect.value;
      if(!validValue(v,value))return {ok:false,reason:v.type==='item'&&value<0?'Не хватает предмета: '+v.name:'Недопустимое значение: '+v.name};
      next[v.id]=value;
    }
    return {ok:true,state:next};
  }
  function effectsSummary(choice,variables){
    return (choice.effects||[]).map(e=>{
      const v=variables.find(v=>v.id===e.variable);if(!v)return 'Параметр удалён';
      if(v.type==='flag')return v.name+': '+(e.op==='toggle'?'переключить':e.value?'включить':'выключить');
      return `${v.name}: ${e.op==='set'?'= ':e.value>=0?'+':''}${e.value}${v.type==='item'?' шт.':''}`;
    }).join('; ');
  }
  const rollBands=['1–5 · до 25%','6–10 · до 50%','11–15 · до 75%','16–17 · 80–85%','18–20 · 90–100% · Крит'];
  function checkSummary(choice){return choice.check?'D20 · выход зависит от броска':'';}
  function resolve(choice,variables,state,random=Math.random){
    const next=transition(choice,variables,state);if(!next.ok)return next;
    if(!choice.check)return {...next,target:choice.target};
    const roll=Math.max(1,Math.min(20,Math.floor(random()*20)+1)),band=roll<=5?0:roll<=10?1:roll<=15?2:roll<=17?3:4;
    const success=!!choice.check.targets[band],target=choice.check.targets[band]||choice.check.failureTarget;
    const message=`🎲 D20: ${roll} (${roll*5}%) · ${success?rollBands[band]:'Провал'}${target?'':' · Остаётесь в сцене.'}`;
    return {ok:true,state:success?next.state:{...state},target:target||null,roll:{value:roll,band,success,message}};
  }
  function initialState(variables){return Object.fromEntries(variables.map(v=>[v.id,v.initial]));}
  function allowed(choice,variables,state){
    const rules=choice.conditions||[];if(!rules.length)return true;
    const results=rules.map(r=>{
      const v=variables.find(v=>v.id===r.variable);
      return !!v&&Object.hasOwn(state,v.id)&&validValue(v,state[v.id])&&compare(state[v.id],r.op,r.value);
    });
    return choice.conditionMode==='any'?results.some(Boolean):results.every(Boolean);
  }
  function describe(rule,variables){
    const v=variables.find(v=>v.id===rule.variable);if(!v)return 'Параметр удалён';
    if(v.type==='flag')return `${v.name}: ${(rule.op==='eq'?rule.value:!rule.value)?'включён':'выключен'}`;
    return `${v.name} ${operators[rule.op]} ${rule.value}${v.type==='item'?' шт.':''}`;
  }
  function summary(choice,variables){
    if(!choice.conditions?.length)return 'Без условий';
    return choice.conditions.map(r=>describe(r,variables)).join(choice.conditionMode==='any'?' ИЛИ ':' И ');
  }
  const api={types,operators,validValue,validateVariables,validateChoice,initialState,allowed,describe,summary,transition,effectsSummary,resolve,rollBands,checkSummary};
  api.standaloneSource=()=>`(${installQuestRules.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestRules=api;
})(globalThis);

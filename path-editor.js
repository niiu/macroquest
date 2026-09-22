'use strict';
let pathDraft=null;
function variables(){return project.variables||[];}
function appendOptions(select,entries){for(const [value,label] of entries){const option=el('option','',label);option.value=value;select.append(option);}return select;}
function openPathEditor(source,choice=null,target=null){
  cancelConnection();pathDraft={source,original:choice,conditions:structuredClone(choice?.conditions||[]),effects:structuredClone(choice?.effects||[])};
  $('path-heading').textContent=choice?'Редактирование перехода':'Новый переход';$('path-source').textContent='Из сцены: '+source.title;
  $('path-text').value=choice?.text||'Перейти в '+(project.scenes.find(s=>s.id===target)?.title||'сцену');
  $('path-target').replaceChildren();appendOptions($('path-target'),project.scenes.map(s=>[s.id,s.title||'Без названия']));$('path-target').value=choice?.target||target||source.id;
  $('condition-mode').value=choice?.conditionMode||'all';$('delete-path').hidden=!choice;$('delete-path').textContent='Удалить путь';$('path-error').textContent='';
  pathDraft.check=choice?.check?structuredClone(choice.check):null;$('path-dice').checked=!!pathDraft.check;renderDiceTargets();
  renderConditions();renderEffects();$('path-dialog').showModal();
}
function closePathEditor(){$('path-dialog').close();pathDraft=null;}
$('close-path').onclick=$('cancel-path').onclick=closePathEditor;
$('path-dialog').addEventListener('cancel',()=>{pathDraft=null;});
function valueControl(variable,value,label){
  const control=variable.type==='flag'?appendOptions(el('select'),[['true','Включён'],['false','Выключен']]):el('input');
  if(variable.type!=='flag'){control.type='number';control.step=variable.type==='item'?'1':'any';if(variable.type==='item')control.min='0';control.required=true;}
  control.value=String(value);control.setAttribute('aria-label',label);return control;
}
function controlValue(variable,control){return variable.type==='flag'?control.value==='true':control.valueAsNumber;}
function renderConditions(){
  $('path-conditions').replaceChildren();if(!pathDraft)return;
  pathDraft.conditions.forEach((rule,i)=>{
    const row=el('div','condition-row'),parameter=el('select');parameter.setAttribute('aria-label',`Параметр условия ${i+1}`);appendOptions(parameter,variables().map(v=>[v.id,`${QuestRules.types[v.type]} · ${v.name}`]));parameter.value=rule.variable;
    const variable=variables().find(v=>v.id===rule.variable);if(!variable){row.append(el('span','form-error','Параметр отсутствует'));$('path-conditions').append(row);return;}
    parameter.onchange=()=>{const v=variables().find(v=>v.id===parameter.value);rule.variable=v.id;rule.op=v.type==='flag'?'eq':'gte';rule.value=v.type==='flag'?true:v.type==='item'?1:0;renderConditions();};
    const op=el('select');op.setAttribute('aria-label',`Сравнение условия ${i+1}`);appendOptions(op,Object.entries(QuestRules.operators).filter(([key])=>variable.type!=='flag'||['eq','ne'].includes(key)));op.value=rule.op;op.onchange=()=>{rule.op=op.value;};
    const value=valueControl(variable,rule.value,`Значение условия ${i+1}`);value.oninput=()=>{rule.value=controlValue(variable,value);};
    const remove=el('button','icon','×');remove.type='button';remove.setAttribute('aria-label',`Удалить условие ${i+1}`);remove.onclick=()=>{pathDraft.conditions.splice(i,1);renderConditions();};
    row.append(parameter,op,value,remove);$('path-conditions').append(row);
  });
  if(!pathDraft.conditions.length)$('path-conditions').append(el('p','empty-conditions','Путь пока доступен без ограничений.'));
  $('add-condition').disabled=pathDraft.conditions.length>=100;
}
$('add-condition').onclick=()=>{
  if(!variables().length){openParameters();$('variable-error').textContent='Сначала добавьте параметр, затем вернитесь к условиям пути.';return;}
  const v=variables()[0];pathDraft.conditions.push({variable:v.id,op:v.type==='flag'?'eq':'gte',value:v.type==='flag'?true:v.type==='item'?1:0});renderConditions();
};
$('path-form').onsubmit=e=>{
  e.preventDefault();if(!pathDraft)return;
  const {source,original,conditions,effects}=pathDraft;
  const data={text:$('path-text').value.trim(),target:$('path-target').value,conditions,effects,conditionMode:$('condition-mode').value};
  data.check=pathDraft.check;
  if(data.check)data.target=data.check.targets.find(Boolean)||data.check.failureTarget;
  try{
    if(!data.text)throw Error('Укажите текст действия.');
    if(!project.scenes.includes(source)||!project.scenes.some(s=>s.id===data.target))throw Error('Сцена больше не существует.');
    QuestRules.validateChoice(data,variables());
    if(data.check&&[...data.check.targets,data.check.failureTarget].some(t=>t&&!project.scenes.some(s=>s.id===t)))throw Error('Выход проверки ссылается на удалённую сцену.');
    if(original){if(!source.choices.includes(original))throw Error('Путь больше не существует.');Object.assign(original,data);}
    else source.choices.push({...data,zone:[]});
    selected=source.id;activeChoice=original?source.choices.indexOf(original):source.choices.length-1;
    closePathEditor();save();renderGraph();renderInspector();
  }catch(error){$('path-error').textContent=error.message;}
};
function renderDiceTargets(){
  $('dice-targets').replaceChildren();$('dice-targets').hidden=!pathDraft?.check;$('path-target').disabled=!!pathDraft?.check;
  if(!pathDraft?.check)return;
  QuestRules.rollBands.forEach((band,i)=>{const label=el('label','field',band),select=el('select');select.setAttribute('aria-label','Выход D20: '+band);appendOptions(select,[['','Провал'],...project.scenes.map(s=>[s.id,s.title])]);select.value=pathDraft.check.targets[i];select.onchange=()=>{pathDraft.check.targets[i]=select.value;};label.append(select);$('dice-targets').append(label);});
  const label=el('label','field','Сцена провала'),failure=el('select');failure.setAttribute('aria-label','Сцена провала');appendOptions(failure,project.scenes.map(s=>[s.id,s.title]));failure.value=pathDraft.check.failureTarget;failure.onchange=()=>{pathDraft.check.failureTarget=failure.value;};label.append(failure);$('dice-targets').append(label);
}
$('path-dice').onchange=()=>{pathDraft.check=$('path-dice').checked?{targets:['','','','',''],failureTarget:pathDraft.source.id}:null;renderDiceTargets();};
$('delete-path').onclick=()=>{
  if(!pathDraft?.original)return;
  if(!pathDraft.confirmDelete){pathDraft.confirmDelete=true;$('delete-path').textContent='Подтвердить удаление';$('path-error').textContent='Будут удалены путь, его условия и нарисованная зона. Нажмите «Подтвердить удаление» или «Отмена».';return;}
  const {source,original}=pathDraft;source.choices=source.choices.filter(c=>c!==original);closePathEditor();save();renderGraph();renderInspector();
};
function openParameters(){$('variable-error').textContent='';renderVariables();$('parameters-dialog').showModal();}
$('quest-parameters').onclick=$('path-parameters').onclick=$('effects-parameters').onclick=openParameters;
$('close-parameters').onclick=()=>$('parameters-dialog').close();
$('parameters-dialog').addEventListener('close',()=>{if(pathDraft){renderConditions();renderEffects();}renderGraph();renderChoices();});
function renderVariables(){
  $('variables-list').replaceChildren();
  for(const variable of variables()){
    const row=el('div','variable-row'),name=el('input');name.value=variable.name;name.maxLength=100;name.required=true;name.setAttribute('aria-label','Название параметра '+variable.name);
    name.onchange=()=>{
      const next=name.value.trim();
      if(!next||variables().some(v=>v!==variable&&v.type===variable.type&&v.name.toLowerCase()===next.toLowerCase())){name.value=variable.name;$('variable-error').textContent='Название должно быть непустым и уникальным внутри типа.';return;}
      variable.name=next;$('variable-error').textContent='';save();
    };
    const value=valueControl(variable,variable.initial,'Начальное значение: '+variable.name);value.oninput=()=>{
      const next=controlValue(variable,value);
      if(!QuestRules.validValue(variable,next)){value.setCustomValidity(variable.type==='item'?'Количество должно быть целым и неотрицательным.':'Укажите число.');return;}
      value.setCustomValidity('');if(variable.initial!==next){variable.initial=next;save();}
    };value.onchange=()=>{value.oninput();value.reportValidity();};
    const valueLabel=el('label','variable-value','Начальное значение');valueLabel.append(value);
    const remove=el('button','quiet','Удалить');remove.onclick=()=>{
      const uses=c=>[...(c.conditions||[]),...(c.effects||[])].some(r=>r.variable===variable.id);
      if(project.scenes.some(s=>s.choices.some(uses))||pathDraft&&uses(pathDraft)){$('variable-error').textContent='Параметр используется в условиях или последствиях. Сначала уберите эти ссылки из путей.';return;}
      project.variables=variables().filter(v=>v!==variable);save();renderVariables();
    };
    const title=el('div','variable-title');title.append(el('span','eyebrow',QuestRules.types[variable.type]),name);row.append(title,valueLabel,remove);$('variables-list').append(row);
  }
  if(!variables().length)$('variables-list').append(el('p','empty-conditions','Параметров пока нет. Например: Сила = 5, Ключ = 1, Дверь открыта = выключен.'));
}
$('variable-form').onsubmit=e=>{
  e.preventDefault();const name=$('variable-name').value.trim(),type=$('variable-type').value;
  if(!name||variables().some(v=>v.type===type&&v.name.toLowerCase()===name.toLowerCase())){$('variable-error').textContent='Укажите уникальное название для этого типа параметра.';return;}
  if(variables().length>=200){$('variable-error').textContent='Максимум 200 параметров.';return;}
  project.variables??=[];project.variables.push({id:'v'+crypto.randomUUID(),name,type,initial:type==='flag'?false:0});
  $('variable-name').value='';$('variable-error').textContent='';save();renderVariables();
};
function renderPlayerState(){
  $('player-state').replaceChildren();
  for(const variable of variables()){
    const label=el('label','player-variable',`${QuestRules.types[variable.type]} · ${variable.name}`),value=valueControl(variable,playerState[variable.id],'В прохождении: '+variable.name);
    value.oninput=()=>{
      const next=controlValue(variable,value);if(!QuestRules.validValue(variable,next)){value.setCustomValidity('Укажите допустимое значение.');return;}
      value.setCustomValidity('');
      playerState[variable.id]=next;renderPlayerChoices();drawPlayerZones();$('play-hotspot').textContent='Выберите область на изображении';
    };value.onchange=()=>{value.oninput();value.reportValidity();};
    label.append(value);$('player-state').append(label);
  }
  if(!variables().length)$('player-state').append(el('p','hint','Параметры ещё не заданы. Добавьте их через «Параметры квеста» над графом.'));
}

function renderEffects(){
  $('path-effects').replaceChildren();if(!pathDraft)return;
  pathDraft.effects.forEach((effect,i)=>{
    const row=el('div','condition-row effect-row'),parameter=el('select');
    parameter.setAttribute('aria-label',`Параметр последствия ${i+1}`);
    appendOptions(parameter,variables().map(v=>[v.id,`${QuestRules.types[v.type]} · ${v.name}`]));parameter.value=effect.variable;
    const v=variables().find(v=>v.id===effect.variable);if(!v)return;
    parameter.onchange=()=>{const next=variables().find(v=>v.id===parameter.value);effect.variable=next.id;effect.op=next.type==='flag'?'set':'add';effect.value=next.type==='flag'?true:1;renderEffects();};
    const op=el('select');op.setAttribute('aria-label',`Операция последствия ${i+1}`);
    appendOptions(op,v.type==='flag'?[['set','Установить'],['toggle','Переключить']]:[['add','Изменить на'],['set','Установить']]);op.value=effect.op;
    op.onchange=()=>{effect.op=op.value;if(effect.op==='toggle')delete effect.value;else if(effect.value===undefined)effect.value=v.type==='flag'?true:0;renderEffects();};
    const value=effect.op==='toggle'?el('span','hint','Обратное состояние'):valueControl(v,effect.value,`Значение последствия ${i+1}`);
    if(effect.op!=='toggle'){if(v.type==='item'&&effect.op==='add')value.removeAttribute('min');value.oninput=()=>{effect.value=controlValue(v,value);};}
    const remove=el('button','icon','×');remove.type='button';remove.setAttribute('aria-label',`Удалить последствие ${i+1}`);remove.onclick=()=>{pathDraft.effects.splice(i,1);renderEffects();};
    row.append(parameter,op,value,remove);$('path-effects').append(row);
  });
  if(!pathDraft.effects.length)$('path-effects').append(el('p','empty-conditions','Переход пока не меняет состояние персонажа.'));
  $('add-effect').disabled=pathDraft.effects.length>=100;
}
$('add-effect').onclick=()=>{
  if(!variables().length){openParameters();$('variable-error').textContent='Добавьте характеристику, предмет или флаг, затем вернитесь к последствиям перехода.';return;}
  const v=variables()[0];pathDraft.effects.push({variable:v.id,op:v.type==='flag'?'set':'add',value:v.type==='flag'?true:1});renderEffects();
};

/* Shared save format and controls for the editor preview and standalone HTML. */
(function installQuestSaves(root){
  'use strict';
  function questKey(quest){
    // Ignore editor coordinates; include the playable version, with normalized defaults.
    const data=JSON.stringify({title:quest.title,start:quest.start,...(quest.characters?.length?{characters:quest.characters}:{}),variables:quest.variables||[],scenes:quest.scenes.map(s=>({id:s.id,title:s.title,text:s.text,...(s.actors?.length?{actors:s.actors}:{}),image:s.image||'',choices:s.choices.map(c=>({text:c.text,target:c.target,...(c.check?{check:c.check}:{}),zone:c.zone||[],conditions:c.conditions||[],conditionMode:c.conditionMode||'all',effects:c.effects||[]}))}))});
    let a=2166136261,b=2246822507;
    for(let i=0;i<data.length;i++){const c=data.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489909);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+'-'+data.length;
  }
  function validate(quest,data,key=questKey(quest)){
    if(!data||data.format!=='macroquest-save'||data.version!==1)throw Error('Это не файл сохранения Макроквеста.');
    if(data.questKey!==key)throw Error('Сохранение относится к другому квесту или другой версии.');
    if(!quest.scenes.some(s=>s.id===data.scene))throw Error('Сцена сохранения отсутствует в квесте.');
    const variables=quest.variables||[];
    if(!data.state||Array.isArray(data.state)||typeof data.state!=='object'||Object.keys(data.state).length!==variables.length)throw Error('Повреждено состояние персонажа.');
    for(const v of variables){
      const value=data.state[v.id];
      if(!Object.hasOwn(data.state,v.id)||(v.type==='flag'?typeof value!=='boolean':!Number.isFinite(value)||v.type==='item'&&(!Number.isInteger(value)||value<0)))throw Error('Некорректное значение параметра: '+v.name);
    }
    if(typeof data.savedAt!=='string'||!Number.isFinite(Date.parse(data.savedAt)))throw Error('Некорректная дата сохранения.');
    return {scene:data.scene,state:Object.fromEntries(variables.map(v=>[v.id,data.state[v.id]])),savedAt:data.savedAt};
  }
  function make(quest,scene,state,key=questKey(quest)){
    const data={format:'macroquest-save',version:1,questKey:key,questTitle:quest.title,scene,state:{...state},savedAt:new Date().toISOString()};
    validate(quest,data,key);return data;
  }
  function attach({host,quest,getState,onLoad,namespace='game'}){
    const key=questKey(quest);let disposed=false;
    const create=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
    host.replaceChildren();
    const details=create('details'),summary=create('summary','Сохранения'),bar=create('div'),slot=create('select'),status=create('p'),save=create('button','Сохранить'),load=create('button','Загрузить'),download=create('button','↓ Сейв в файл'),upload=create('button','↑ Загрузить файл'),file=create('input');
    details.className='save-panel';bar.className='save-controls';status.className='save-status';status.setAttribute('role','status');slot.setAttribute('aria-label','Слот сохранения');
    for(const [value,label] of [['1','Слот 1'],['2','Слот 2'],['3','Слот 3'],['auto','Автосохранение']]){const option=create('option',label);option.value=value;slot.append(option);}slot.value='1';
    file.type='file';file.accept='.json,application/json';file.hidden=true;
    for(const button of [save,load,download,upload])button.type='button';
    const hint=create('p','Три слота и автосохранение после переходов. Файл сейва можно перенести между устройствами или загрузить в ту же версию квеста.');hint.className='save-hint';
    bar.append(slot,save,load,download,upload,file);details.append(summary,bar,status,hint);host.append(details);
    const storageKey=id=>`macroquest.playthrough.v1.${namespace}.${key}.${id}`;
    const snapshot=()=>{const s=getState();return make(quest,s.scene,s.state,key);};
    function refresh(){
      if(disposed)return;save.disabled=slot.value==='auto';
      try{
        const raw=root.localStorage.getItem(storageKey(slot.value));load.disabled=!raw;
        if(!raw){status.textContent='Этот слот пуст.';return;}
        const saved=validate(quest,JSON.parse(raw),key);
        status.textContent=quest.scenes.find(s=>s.id===saved.scene).title+' · '+new Date(saved.savedAt).toLocaleString('ru-RU');
      }catch(error){load.disabled=true;status.textContent='Слот недоступен: '+error.message+' Используйте файл сейва.';}
    }
    function write(id,automatic=false){
      if(disposed)return;
      try{root.localStorage.setItem(storageKey(id),JSON.stringify(snapshot()));refresh();status.textContent=(automatic?'Автосохранено':'Сохранено в слот '+id)+' · '+quest.scenes.find(s=>s.id===getState().scene).title;}
      catch(error){status.textContent='Не удалось сохранить в браузере. Скачайте сейв в файл.';}
    }
    function restore(data){
      const saved=validate(quest,data,key);if(disposed)return;
      onLoad(saved);status.textContent='Загружено: '+quest.scenes.find(s=>s.id===saved.scene).title;
    }
    slot.onchange=refresh;save.onclick=()=>write(slot.value);
    load.onclick=()=>{try{const raw=root.localStorage.getItem(storageKey(slot.value));if(!raw)throw Error('Слот пуст.');restore(JSON.parse(raw));}catch(error){status.textContent='Не удалось загрузить: '+error.message;}};
    download.onclick=()=>{
      try{
        const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'})),a=create('a');
        a.href=url;a.download=(quest.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'quest')+'.save.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Файл сохранения подготовлен.';
      }catch(error){status.textContent='Не удалось подготовить сейв: '+error.message;}
    };
    upload.onclick=()=>file.click();
    file.onchange=async()=>{
      const selected=file.files[0];if(!selected)return;
      try{if(selected.size>1024*1024)throw Error('Максимальный размер сейва — 1 МБ.');const data=JSON.parse(await selected.text());if(!disposed)restore(data);}
      catch(error){if(!disposed)status.textContent='Не удалось загрузить: '+error.message;}
      finally{file.value='';}
    };
    refresh();
    return {autosave:()=>write('auto',true),refresh,dispose:()=>{disposed=true;}};
  }
  const api={questKey,validate,make,attach};api.standaloneSource=()=>`(${installQuestSaves.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestSaves=api;
})(globalThis);

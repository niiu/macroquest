(function(root){
  'use strict';
  const rules=typeof module!=='undefined'?require('./rules.js'):root.QuestRules;
  const zones=typeof module!=='undefined'?require('./zones.js'):root.QuestZones;
  const layers=typeof module!=='undefined'?require('./scene-layers.js'):root.QuestLayers;
  const saves=typeof module!=='undefined'?require('./saves.js'):root.QuestSaves;
  const escapeHTML=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeJSON=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));

  // This function is embedded verbatim. It only depends on the bundled engines and DOM.
  function runQuest(){
    'use strict';
    const $=id=>document.getElementById(id);
    const quest=JSON.parse($('quest-data').textContent),variables=quest.variables||[];
    let current=quest.start,state=QuestRules.initialState(variables),imageReady=false;
    const saveControls=QuestSaves.attach({host:$('game-saves'),quest,getState:()=>({scene:current,state}),onLoad:saved=>{current=saved.scene;state=saved.state;$('restart-confirm').hidden=true;render();$('scene-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});}});
    const activeScene=()=>quest.scenes.find(s=>s.id===current);
    const result=choice=>QuestRules.transition(choice,variables,state);
    function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
    function take(choice){
      const next=QuestRules.resolve(choice,variables,state);if(!next.ok)return;
      state=next.state;current=next.target||current;render();$('roll-result').textContent=next.roll?.message||'';saveControls.autosave();$('scene-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
    }
    function drawZones(){if(imageReady)QuestZones.draw($('zones'),$('show-zones').checked?activeScene().choices:[]);}
    function hit(event){
      if(!imageReady)return null;
      const canvas=$('zones'),r=canvas.getBoundingClientRect();
      if(!r.width||!r.height)return null;
      const x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
      const index=QuestZones.hit(activeScene().choices,x,y,canvas.width,canvas.height);
      return activeScene().choices[index]||null;
    }
    function render(){
      const scene=activeScene();$('roll-result').textContent='';
      $('scene-title').textContent=scene.title||'Без названия';$('scene-text').textContent=scene.text;
      $('choices').replaceChildren();
      for(const choice of scene.choices){
        if(scene.image&&QuestLayers.onImage(choice))continue;
        const availability=result(choice),button=element('button',(availability.ok?'→ ':'🔒 ')+choice.text+(choice.check?' · 🎲 D20':''),'choice');
        button.disabled=!availability.ok;button.onclick=()=>take(choice);$('choices').append(button);
        if(!availability.ok)$('choices').append(element('p',availability.reason,'muted reason'));
      }
      QuestLayers.actors($('actors'),scene,quest.characters||[]);QuestLayers.paths($('image-paths'),scene,quest.scenes,result,take);
      $('ending').hidden=!!scene.choices.length;
      $('no-paths').hidden=!scene.choices.length||scene.choices.some(c=>result(c).ok);
      $('state').replaceChildren();$('state-panel').hidden=!variables.length;
      for(const type of ['stat','item','flag']){
        const entries=variables.filter(v=>v.type===type);if(!entries.length)continue;
        const group=element('section');group.append(element('h3',{stat:'Характеристики',item:'Предметы',flag:'Флаги'}[type]));
        const list=element('dl');
        for(const v of entries){list.append(element('dt',v.name),element('dd',type==='flag'?(state[v.id]?'Включён':'Выключен'):String(state[v.id])+(type==='item'?' шт.':'')));}
        group.append(list);$('state').append(group);
      }
      imageReady=false;$('image-wrap').hidden=!scene.image;$('image-error').hidden=true;
      $('hotspot').textContent='Нажмите на область изображения или выберите действие ниже.';$('zones').style.cursor='default';
      const image=$('image'),canvas=$('zones');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      image.onload=()=>{if(activeScene()!==scene)return;canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;imageReady=true;drawZones();};
      image.onerror=()=>{if(activeScene()!==scene)return;imageReady=false;$('image-wrap').hidden=true;$('image-error').hidden=false;for(const c of scene.choices.filter(QuestLayers.onImage)){const b=element('button',c.text,'choice');b.disabled=!result(c).ok;b.onclick=()=>take(c);$('choices').append(b);}};
      if(scene.image){image.alt=scene.title||'Локация';image.src=scene.image;}else image.removeAttribute('src');
    }
    $('zones').onclick=e=>{const choice=hit(e);if(choice)take(choice);};
    $('zones').onpointermove=e=>{const choice=hit(e),availability=choice?result(choice):null;$('zones').style.cursor=!choice?'default':availability.ok?'pointer':'not-allowed';$('hotspot').textContent=!choice?'Выберите область на изображении':availability.ok?choice.text:'🔒 '+choice.text+' · '+availability.reason;};
    $('zones').onpointerleave=()=>{$('hotspot').textContent='Нажмите на область изображения или выберите действие ниже.';};
    $('show-zones').onchange=drawZones;
    $('restart').onclick=()=>{$('restart-confirm').hidden=false;$('confirm-restart').focus();};
    $('cancel-restart').onclick=()=>{$('restart-confirm').hidden=true;$('restart').focus();};
    $('confirm-restart').onclick=()=>{current=quest.start;state=QuestRules.initialState(variables);$('restart-confirm').hidden=true;render();$('scene-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});};
    render();
  }
  function build(project){
    const quest={version:1,title:project.title,start:project.start,...(project.characters?.length?{characters:project.characters}:{}),variables:project.variables||[],scenes:project.scenes.map(s=>({id:s.id,title:s.title,text:s.text,...(s.actors?.length?{actors:s.actors}:{}),...(s.image?{image:s.image}:{}),choices:s.choices.map(c=>({text:c.text,target:c.target,...(c.check?{check:c.check}:{}),zone:c.zone||[],conditions:c.conditions||[],conditionMode:c.conditionMode||'all',effects:c.effects||[]}))}))};
    rules.validateVariables(quest.variables);layers.validate(quest);
    const ids=new Set(quest.scenes.map(s=>s.id));
    if(!ids.has(quest.start)||ids.size!==quest.scenes.length)throw Error('Проверьте начальную сцену и идентификаторы.');
    for(const scene of quest.scenes){
      if(scene.image&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(scene.image))throw Error('Для экспорта нужны встроенные изображения.');
      for(const c of scene.choices){rules.validateChoice(c,quest.variables);if(c.check&&[...c.check.targets,c.check.failureTarget].some(t=>t&&!ids.has(t))||!ids.has(c.target)||!zones.validStrokes(c.zone))throw Error('Некорректный переход или зона.');}
    }
    return `<!doctype html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(quest.title)}</title>
<style>
:root{color-scheme:dark;font:16px/1.7 system-ui,sans-serif;background:#121811;color:#e5e8dc}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}header{display:flex;align-items:center;justify-content:space-between;gap:20px;max-width:1000px;margin:auto;padding:24px}header span{color:#b9cc8e;font-size:13px;letter-spacing:1px;overflow-wrap:anywhere}main{max-width:1000px;margin:0 auto 40px;padding:32px;background:#1d251b;border:1px solid #3e4c34;border-radius:12px}h1{font:36px/1.25 Georgia,serif;margin:10px 0 28px;overflow-wrap:anywhere}h1:focus{outline:none}.ornament{color:#c1d38e;font-size:26px}button{font:inherit;background:#2c3924;color:#e7efd9;border:1px solid #62754a;border-radius:6px;padding:10px 16px;cursor:pointer}button:hover:enabled{background:#405132}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #d5e89d;outline-offset:3px}button:disabled{opacity:.55;cursor:not-allowed}.choice{display:block;width:100%;text-align:left;margin-top:12px;overflow-wrap:anywhere}.scene-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:26px 0}.image-surface{position:relative;line-height:0}.image-surface img{width:100%;height:auto;display:block;border-radius:6px}.image-surface canvas{position:absolute;inset:0;width:100%;height:100%}.image-tools{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:#adb99d}.image-tools label{white-space:nowrap}input{accent-color:#b9cc8e}.muted{color:#acb79e}.reason{font-size:12px;margin:4px 0 12px}details{margin-top:32px;border-top:1px solid #3e4c34;padding-top:16px}summary{cursor:pointer;color:#c4d49e}#state{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px}h3{font-size:13px;font-weight:600;color:#a7b993}dl{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:13px}dt{overflow-wrap:anywhere}dd{margin:0;color:#d7e5bc}#restart-confirm{max-width:1000px;margin:0 auto 20px;padding:18px 24px;background:#303a27;border-radius:8px}#restart-confirm button{margin-right:8px}#ending{color:#c2d58a;letter-spacing:3px;font-size:13px;margin-top:28px}footer{max-width:1000px;margin:0 auto 32px;text-align:center;font-size:11px;color:#839376}@media(max-width:700px){header{padding:16px}header button{font-size:12px;flex-shrink:0}main{padding:20px 16px;margin:0 10px 24px}h1{font-size:28px}.scene-text{font-size:15px}#restart-confirm{margin:0 10px 16px}}
.save-panel{margin:0 0 24px;padding:12px;border:1px solid #46513d;border-radius:6px}.save-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.save-controls button,.save-controls select{font:13px system-ui;padding:8px;border-radius:4px}.save-controls select{background:#202b1b;color:#e7efd9;border:1px solid #62754a}.save-status,.save-hint{font-size:12px;color:#b7c5a6;margin:10px 0 0}.save-panel summary{cursor:pointer}${layers.css}</style></head><body><header><span>${escapeHTML(quest.title)}</span><button id="restart">↺ Начать сначала</button></header>
<section id="restart-confirm" hidden aria-label="Начать заново"><p>Начать квест заново? Текущее прохождение будет сброшено.</p><button id="confirm-restart">Начать заново</button><button id="cancel-restart">Продолжить игру</button></section>
<main><div id="game-saves"></div><div class="ornament" aria-hidden="true">✦</div><h1 id="scene-title" tabindex="-1"></h1><div id="image-wrap" hidden><div class="image-surface"><img id="image" alt="Локация"><div id="actors" class="actor-layer"></div><div id="image-paths" class="image-paths"></div><canvas id="zones" aria-label="Зоны действий на изображении"></canvas></div><div class="image-tools"><span id="hotspot" role="status"></span><label><input id="show-zones" type="checkbox"> Подсветить зоны</label></div></div><p id="image-error" class="muted" hidden>Изображение недоступно. Используйте кнопки действий.</p><p id="scene-text" class="scene-text"></p><p id="roll-result" role="status"></p><div id="choices"></div><p id="ending" hidden>КОНЕЦ ИСТОРИИ</p><p id="no-paths" class="muted" hidden>Нет доступных действий. Можно начать квест заново.</p><details id="state-panel"><summary>Персонаж и инвентарь</summary><div id="state"></div></details><noscript>Для прохождения квеста включите JavaScript в браузере.</noscript></main><footer>Создано в Макроквесте · Продолжить игру можно через «Сохранения»</footer>
<script id="quest-data" type="application/json">${safeJSON(quest)}</script>
<script>${rules.standaloneSource()}\n${zones.standaloneSource()}\n${saves.standaloneSource()}\n${layers.standaloneSource()}\n(${runQuest.toString()})();</script></body></html>`;
  }
  const api={build};
  if(typeof module!=='undefined')module.exports=api;else root.QuestHTML=api;
})(globalThis);


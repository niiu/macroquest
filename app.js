'use strict';
const STORAGE_KEY = 'macroquest.project.v1';
const $ = id => document.getElementById(id);
const sample = () => ({version:1,title:'Безымянные земли',start:'s1',scenes:[
  {id:'s1',title:'На краю леса',text:'Последний луч солнца гаснет за деревьями. Перед вами — старый лес, о котором в деревне говорят лишь шёпотом.\n\nНа развилке стоит покосившийся указатель. Куда вы направитесь?',x:70,y:75,choices:[{text:'Пойти к старой башне',target:'s2'},{text:'Спуститься к реке',target:'s3'}]},
  {id:'s2',title:'Старая башня',text:'Дверь башни приоткрыта. На каменной лестнице лежит письмо с вашим именем.\n\nВы разворачиваете его. «Я знал, что ты придёшь. Встретимся у реки».',x:390,y:55,choices:[{text:'Отправиться к реке',target:'s3'}]},
  {id:'s3',title:'Тихая переправа',text:'На берегу вас ждёт лодочник. Не говоря ни слова, он протягивает руку и помогает сесть в лодку.\n\nЗа туманом мерцают огни незнакомого города.',x:390,y:320,choices:[{text:'Пересечь реку',target:'s4'},{text:'Вернуться к развилке',target:'s1'}]},
  {id:'s4',title:'За горизонтом',text:'Лодка касается другого берега. Вы делаете шаг навстречу огням.\n\nСтарая жизнь осталась за рекой. Ваша история только начинается.',x:710,y:320,choices:[]}
]});
function validate(p){
  if(!p || p.version!==1 || typeof p.title!=='string' || !Array.isArray(p.scenes) || !p.scenes.length || p.scenes.length>500) throw Error('Неверный формат квеста. Нужен JSON версии 1 с 1–500 сценами.');
  if(p.scenes.some(s=>!s || typeof s!=='object')) throw Error('Некорректная сцена.');
  const ids=new Set(p.scenes.map(s=>s.id));
  if(ids.size!==p.scenes.length || !ids.has(p.start)) throw Error('Проверьте идентификаторы и начальную сцену.');
  QuestRules.validateVariables(p.variables||[]);
  QuestLayers.validate(p);
  if(p.graphSize!==undefined&&!QuestGraphArea.valid(p.graphSize))throw Error('Некорректный размер поля графа.');
  for(const s of p.scenes){
    if(typeof s.id!=='string'||typeof s.title!=='string'||typeof s.text!=='string'||!Number.isFinite(s.x)||!Number.isFinite(s.y)||s.x<0||s.y<0||s.x>100000||s.y>100000||!Array.isArray(s.choices)||s.choices.some(c=>!c||typeof c.text!=='string'||!ids.has(c.target))) throw Error('В квесте есть повреждённая сцена или переход.');
    if(s.image !== undefined && (typeof s.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s.image))) throw Error('Изображение должно быть встроенным PNG, JPEG или WebP.');
    if(s.choices.some(c=>c.zone!==undefined && !QuestZones.validStrokes(c.zone))) throw Error('Некорректная зона действия.');
    s.choices.forEach(c=>{QuestRules.validateChoice(c,p.variables||[]);if(c.check&&[...c.check.targets,c.check.failureTarget].some(t=>t&&!ids.has(t)))throw Error('Выход D20 ссылается на отсутствующую сцену.');});
  }
  return p;
}
let project=sample();
let selected=project.start,zoom=1,playing=project.start,activeChoice=0,paintTool='paint';
let playerState={};
let previewSaves=null;
let saveRevision=0,saveQueue=Promise.resolve(),pendingSaves=0,saveFailed=false;
const scene=()=>project.scenes.find(s=>s.id===selected);
function save(){
  const revision=++saveRevision,snapshot=structuredClone(project);
  pendingSaves++;$('save-status').textContent='Сохранение…';
  saveQueue=saveQueue.then(async()=>{
    try{await QuestStorage.write(snapshot);saveFailed=false;if(revision===saveRevision)$('save-status').textContent='Сохранено на устройстве';}
    catch(e){saveFailed=true;$('save-status').textContent='Не удалось сохранить — экспортируйте JSON';}
    finally{pendingSaves--;}
  });
}
window.addEventListener('beforeunload',e=>{if(pendingSaves||saveFailed){e.preventDefault();e.returnValue='';}});
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function setEditorOpen(open){$('editor-body').hidden=!open;$('collapse-editor').textContent=open?'Свернуть ↓':'Открыть редактор ↑';$('collapse-editor').setAttribute('aria-expanded',String(open));}
$('collapse-editor').onclick=()=>setEditorOpen($('editor-body').hidden);
function select(id){selected=id;activeChoice=0;setEditorOpen(true);renderGraph();renderInspector();openSceneEditor();}
function renderInspector(){const s=scene();$('scene-heading').textContent=s.title||'Сцена без названия';$('scene-id').textContent=s.id===project.start?'НАЧАЛО':'СЦЕНА';$('scene-title').value=s.title;$('scene-text').value=s.text;$('set-start').disabled=s.id===project.start;$('delete-scene').disabled=project.scenes.length===1;renderChoices();renderImageEditor();renderCharacters();}
function renderChoices(){
  const s=scene();activeChoice=Math.max(0,Math.min(activeChoice,s.choices.length-1));$('choices').replaceChildren();
  s.choices.forEach((c,i)=>{
    const row=el('div','choice'+(i===activeChoice?' active-choice':''));row.style.setProperty('--zone-color',QuestZones.color(i));
    const caption=el('div','choice-caption');caption.append(el('span','zone-dot'),el('strong','',`Действие ${i+1}`));
    const input=el('input');input.value=c.text;input.placeholder='Например: открыть дверь';input.setAttribute('aria-label','Текст действия '+(i+1));input.oninput=()=>{c.text=input.value;save();syncZoneTools();drawEdges();};
    const label=el('label','','ПЕРЕХОД В СЦЕНУ');const target=el('select');target.setAttribute('aria-label','Цель действия '+(i+1));
    project.scenes.forEach(t=>{const o=el('option','',t.title||'Без названия');o.value=t.id;target.append(o);});target.value=c.target;target.onchange=()=>{c.target=target.value;save();renderGraph();};
    const controls=el('div','choice-controls');const paint=el('button','','Нарисовать зону');paint.onclick=()=>{activeChoice=i;renderChoices();setSceneTab('image');paintZones();};
    const conditions=el('button','','Условия и последствия');conditions.onclick=()=>openPathEditor(s,c);
    const remove=el('button','quiet','Удалить действие');remove.onclick=()=>{if(c.zone?.length&&!confirm('Удалить действие вместе с нарисованной зоной?'))return;s.choices.splice(i,1);if(activeChoice>i)activeChoice--;save();renderChoices();renderGraph();paintZones();};
    controls.append(paint,conditions,remove);row.append(caption,input,label,target,el('p','hint',QuestRules.summary(c,project.variables||[])),controls);$('choices').append(row);
    if(c.effects?.length)row.insertBefore(el('p','effect-summary','При переходе: '+QuestRules.effectsSummary(c,project.variables||[])),controls);
  });
  if(!s.choices.length)$('choices').append(el('p','hint','Пока нет действий. Добавьте первое действие, чтобы нарисовать его зону.'));
  syncZoneTools();
}
function render(){cancelConnection();$('quest-title').value=project.title;document.querySelector('.project-name').textContent=project.title+' / Редактор';renderGraph();renderInspector();}
$('quest-title').oninput=e=>{project.title=e.target.value;document.querySelector('.project-name').textContent=project.title+' / Редактор';save();};
$('scene-title').oninput=e=>{scene().title=e.target.value;$('scene-heading').textContent=scene().title||'Сцена без названия';save();renderGraph();renderChoices();};
$('scene-text').oninput=e=>{scene().text=e.target.value;save();renderGraph();};
$('add-scene').onclick=()=>{if(project.scenes.length>=500)return alert('Максимум 500 сцен в одном квесте.');const viewport=$('graph-viewport'),position=QuestGraphArea.position(QuestGraphArea.bounds(project,nodeHeight),(viewport.scrollLeft+viewport.clientWidth/2)/zoom-110,(viewport.scrollTop+viewport.clientHeight/2)/zoom-77);const s={id:'s'+crypto.randomUUID(),title:'Новая сцена',text:'',...position,choices:[]};project.scenes.push(s);save();setSceneTab('text');select(s.id);$('scene-title').focus({preventScroll:true});};
$('add-choice').onclick=()=>openPathEditor(scene(),null,project.scenes.find(s=>s.id!==selected)?.id||selected);
$('set-start').onclick=()=>{project.start=selected;save();render();};
$('delete-scene').onclick=()=>deleteScene(selected);
function setZoom(v){zoom=Math.max(.5,Math.min(1.5,v));$('graph').style.transform=`scale(${zoom})`;$('zoom-label').textContent=Math.round(zoom*100)+'%';resizeGraph();}
$('zoom-in').onclick=()=>setZoom(zoom+.1);$('zoom-out').onclick=()=>setZoom(zoom-.1);
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=(project.title.replace(/[<>:"/\\|?*]/g,'_')||'quest')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('export-html').onclick=()=>{
  try{
    validate(project);
    const html=QuestHTML.build(project),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const a=el('a');a.href=url;a.download=(project.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'quest')+'.html';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('export-status').textContent='HTML-файл подготовлен. Его можно открыть без интернета.';
  }catch(error){$('export-status').textContent='Не удалось экспортировать: '+error.message;}
};
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100*1024*1024)throw Error('Файл слишком большой (максимум 100 МБ).');const next=validate(JSON.parse(await file.text()));if(confirm('Открыть квест вместо текущего? Сначала экспортируйте текущий, если хотите сохранить отдельную копию.')){project=next;selected=project.start;activeChoice=0;save();render();}}catch(err){alert('Не удалось открыть квест: '+err.message);}finally{e.target.value='';}};
$('new-quest').onclick=()=>{if(!confirm('Создать новый квест вместо текущего? Для отдельной копии используйте экспорт.'))return;project={version:1,title:'Новый квест',start:'s1',scenes:[{id:'s1',title:'Начало истории',text:'',x:70,y:75,choices:[]}]};selected='s1';save();render();};
function choiceResult(c){return QuestRules.transition(c,project.variables||[],playerState);}
function choiceAllowed(c){return choiceResult(c).ok;}
function takeChoice(c){const result=QuestRules.resolve(c,project.variables||[],playerState);if(!result.ok)return;playerState=result.state;playing=result.target||playing;renderPlayer();$('play-roll').textContent=result.roll?.message||'';previewSaves?.autosave();$('player').scrollTop=0;}
function renderPlayerChoices(){
  const s=project.scenes.find(s=>s.id===playing);$('play-choices').replaceChildren();
  for(const c of s.choices){if(s.image&&QuestLayers.onImage(c)&&!$('play-image-wrap').dataset.failed)continue;const result=choiceResult(c),b=el('button','',`${result.ok?'→':'🔒'} ${c.text}${c.check?' · 🎲 '+QuestRules.checkSummary(c,project.variables||[]):''}`);b.disabled=!result.ok;b.onclick=()=>takeChoice(c);$('play-choices').append(b);if(!result.ok)$('play-choices').append(el('p','locked-reason',result.reason));}
  QuestLayers.paths($('play-image-paths'),s,project.scenes,choiceResult,takeChoice);
  if(!s.choices.length)$('play-choices').append(el('p','eyebrow','КОНЕЦ ИСТОРИИ'));
  else if(!s.choices.some(choiceAllowed))$('play-choices').append(el('p','hint','Нет доступных путей. Проверьте состояние персонажа или начните сначала.'));
}
function renderPlayer(){$('play-roll').textContent='';delete $('play-image-wrap').dataset.failed;const s=project.scenes.find(s=>s.id===playing);$('play-title').textContent=s.title;$('play-text').textContent=s.text||'Текст этой сцены ещё не написан.';renderPlayerChoices();renderPlayerState();renderPlayerImage(s);}
function startPlayer(){
  previewSaves?.dispose();playing=project.start;playerState=QuestRules.initialState(project.variables||[]);renderPlayer();
  previewSaves=QuestSaves.attach({host:$('preview-saves'),quest:project,namespace:'preview',getState:()=>({scene:playing,state:playerState}),onLoad:saved=>{playing=saved.scene;playerState=saved.state;renderPlayer();$('player').scrollTop=0;}});
}
$('player').addEventListener('close',()=>previewSaves?.dispose());
$('play').onclick=()=>{startPlayer();$('player').showModal();};$('close-player').onclick=()=>$('player').close();$('restart').onclick=()=>{startPlayer();$('player').scrollTop=0;};



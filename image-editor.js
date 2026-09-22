'use strict';
let imageReady=false,strokeSession=null,paintFrame=0,playerImageReady=false;

function syncZoneTools(){
  const s=scene(),choice=s.choices[activeChoice],select=$('zone-choice');
  select.replaceChildren();
  s.choices.forEach((c,i)=>{const option=el('option','',`${i+1}. ${c.text||'Без названия'}`);option.value=i;select.append(option);});
  if(!s.choices.length){const option=el('option','','Сначала добавьте действие');select.append(option);}
  select.value=String(activeChoice);select.disabled=!s.choices.length;
  const enabled=!!(imageReady&&choice);
  for(const id of ['brush-tool','eraser-tool','brush-size'])$(id).disabled=!enabled;
  $('undo-zone').disabled=!enabled||!choice.zone?.length;
  $('clear-zone').disabled=!enabled||!choice.zone?.length;
  $('remove-image').disabled=!s.image;
  $('brush-tool').setAttribute('aria-pressed',String(paintTool==='paint'));
  $('eraser-tool').setAttribute('aria-pressed',String(paintTool==='erase'));
  $('zone-canvas').style.cursor=enabled?'none':'default';
  $('zone-status').textContent=!s.image?'Загрузите изображение, чтобы рисовать зоны.':!imageReady?'Изображение загружается…':!choice?'Добавьте действие под изображением, затем закрасьте его зону.':`${paintTool==='paint'?'Кисть':'Ластик'} · ${choice.text||'Без названия'} · ${choice.zone?.length||0} штрихов. Ластик действует только на выбранную зону.`;
}
function paintZones(){
  const canvas=$('zone-canvas');
  if(!imageReady)return;
  QuestZones.draw(canvas,$('show-zones').checked?scene().choices:[],activeChoice);
}
function renderImageEditor(){
  finishStroke(false);imageReady=false;$('brush-cursor').hidden=true;
  const s=scene(),img=$('scene-image');
  $('image-surface').hidden=!s.image;$('image-empty').hidden=!!s.image;
  $('zone-canvas').getContext('2d').clearRect(0,0,$('zone-canvas').width,$('zone-canvas').height);
  img.onload=()=>{
    if(scene()!==s)return;
    $('zone-canvas').width=img.naturalWidth;$('zone-canvas').height=img.naturalHeight;
    imageReady=true;syncZoneTools();paintZones();
  };
  img.onerror=()=>{if(scene()!==s)return;imageReady=false;syncZoneTools();$('zone-status').textContent='Не удалось прочитать картинку. Загрузите другое изображение.';};
  if(s.image)img.src=s.image;else img.removeAttribute('src');
  syncZoneTools();renderActorLayers();
}
$('zone-choice').onchange=e=>{activeChoice=Number(e.target.value);renderChoices();paintZones();};
function chooseTool(tool){paintTool=tool;$('show-zones').checked=true;syncZoneTools();paintZones();}
$('brush-tool').onclick=()=>chooseTool('paint');$('eraser-tool').onclick=()=>chooseTool('erase');
$('brush-size').oninput=e=>{$('brush-size-label').textContent=e.target.value+' px';};
$('show-zones').onchange=paintZones;
$('undo-zone').onclick=()=>{const c=scene().choices[activeChoice];if(c?.zone?.length){c.zone.pop();save();syncZoneTools();paintZones();}};
$('clear-zone').onclick=()=>{const c=scene().choices[activeChoice];if(c?.zone?.length&&confirm('Очистить всю зону выбранного действия?')){c.zone=[];save();syncZoneTools();paintZones();}};
function pointerPoint(e,canvas){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
function moveCursor(e){
  const r=$('zone-canvas').getBoundingClientRect(),cursor=$('brush-cursor');
  cursor.hidden=!imageReady||!scene().choices[activeChoice]||e.pointerType==='touch';
  const size=Number($('brush-size').value);
  cursor.style.width=cursor.style.height=size+'px';cursor.style.left=(e.clientX-r.left)+'px';cursor.style.top=(e.clientY-r.top)+'px';
  cursor.style.borderColor=paintTool==='erase'?'#fff':QuestZones.color(activeChoice);cursor.classList.toggle('erasing',paintTool==='erase');
}
$('zone-canvas').onpointerdown=e=>{
  if(e.button!==0||!imageReady||strokeSession)return;
  const choice=scene().choices[activeChoice];if(!choice)return;
  choice.zone??=[];
  if(choice.zone.length>=5000){alert('Достигнут предел штрихов для этой зоны.');return;}
  e.preventDefault();$('show-zones').checked=true;
  const r=e.currentTarget.getBoundingClientRect();
  const stroke={mode:paintTool,radius:Math.min(1,Number($('brush-size').value)/(2*Math.min(r.width,r.height))),points:[pointerPoint(e,e.currentTarget)]};
  choice.zone.push(stroke);strokeSession={choice,stroke,pointerId:e.pointerId};
  e.currentTarget.setPointerCapture(e.pointerId);moveCursor(e);paintZones();
};
$('zone-canvas').onpointermove=e=>{
  moveCursor(e);
  if(!strokeSession||e.pointerId!==strokeSession.pointerId)return;
  const points=strokeSession.stroke.points,p=pointerPoint(e,e.currentTarget),previous=points[points.length-1];
  if(points.length<20000&&Math.hypot(p[0]-previous[0],p[1]-previous[1])>.0005)points.push(p);
  if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;paintZones();});
};
function finishStroke(commit){
  if(!strokeSession)return;
  const session=strokeSession;strokeSession=null;
  if(!commit)session.choice.zone.pop();
  if($('zone-canvas').hasPointerCapture(session.pointerId))$('zone-canvas').releasePointerCapture(session.pointerId);
  if(commit)save();syncZoneTools();paintZones();
}
$('zone-canvas').onpointerup=e=>{if(strokeSession?.pointerId===e.pointerId)finishStroke(true);};
$('zone-canvas').onpointercancel=()=>finishStroke(false);
$('zone-canvas').onlostpointercapture=()=>finishStroke(false);
$('zone-canvas').onpointerleave=()=>{$('brush-cursor').hidden=true;};

function decodeImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Не удалось прочитать изображение.'));img.src=src;});}
$('upload-image').onclick=()=>$('image-file').click();
$('image-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const owner=scene(),ownerProject=project;
  $('upload-image').disabled=true;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Выберите PNG, JPG или WebP.');
    if(file.size>15*1024*1024)throw Error('Максимальный размер изображения — 15 МБ.');
    const url=URL.createObjectURL(file);let img;
    try{img=await decodeImage(url);}finally{URL.revokeObjectURL(url);}
    if(project!==ownerProject||!project.scenes.includes(owner))return;
    if(owner.image&&owner.choices.some(c=>c.zone?.length)&&!confirm('Заменить изображение? Нарисованные зоны этой сцены будут очищены.'))return;
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    owner.image=canvas.toDataURL('image/webp',.88);owner.choices.forEach(c=>{c.zone=[];});
    save();if(scene()===owner){renderImageEditor();renderChoices();}renderGraph();
  }catch(err){alert(err.message);}finally{e.target.value='';$('upload-image').disabled=false;}
};
$('remove-image').onclick=()=>{
  if(!scene().image||!confirm('Убрать изображение и все его зоны? Действия и переходы сохранятся.'))return;
  delete scene().image;scene().choices.forEach(c=>{c.zone=[];});save();renderImageEditor();renderChoices();renderGraph();
};

function renderPlayerImage(s){
  playerImageReady=false;$('play-image-wrap').hidden=!s.image;QuestLayers.actors($('play-actors'),s,project.characters||[]);
  $('play-hotspot').textContent='Выберите область на изображении';$('play-zone-canvas').style.cursor='default';
  const img=$('play-image'),canvas=$('play-zone-canvas');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  img.onload=()=>{if(playing!==s.id)return;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;playerImageReady=true;drawPlayerZones();};
  img.onerror=()=>{playerImageReady=false;$('play-image-wrap').dataset.failed='true';renderPlayerChoices();$('play-hotspot').textContent='Картинка недоступна. Используйте кнопки действий.';};
  if(s.image)img.src=s.image;else img.removeAttribute('src');
}
function drawPlayerZones(){if(playerImageReady)QuestZones.draw($('play-zone-canvas'),$('play-show-zones').checked?project.scenes.find(s=>s.id===playing).choices:[]);}
function playerHit(e){if(!playerImageReady)return -1;const canvas=$('play-zone-canvas'),p=pointerPoint(e,canvas);return QuestZones.hit(project.scenes.find(s=>s.id===playing).choices,p[0],p[1],canvas.width,canvas.height);}
$('play-zone-canvas').onpointermove=e=>{const i=playerHit(e),c=project.scenes.find(s=>s.id===playing).choices[i],result=c?choiceResult(c):null;$('play-zone-canvas').style.cursor=!c?'default':result.ok?'pointer':'not-allowed';$('play-hotspot').textContent=!c?'Выберите область на изображении':result.ok?'→ '+(project.scenes.find(s=>s.id===c.target)?.title||'')+' · '+c.text:'🔒 '+c.text+' · '+result.reason;};
$('play-zone-canvas').onpointerleave=()=>{$('play-hotspot').textContent='Выберите область на изображении';};
$('play-zone-canvas').onclick=e=>{const i=playerHit(e);if(i<0)return;takeChoice(project.scenes.find(s=>s.id===playing).choices[i]);};
$('play-show-zones').onchange=drawPlayerZones;

async function initialize(){
  document.querySelector('.workspace').inert=true;$('play').disabled=true;$('save-status').textContent='Загрузка проекта…';
  try{
    let stored;
    try{stored=await QuestStorage.read();}catch(err){/* Legacy text projects can still be read if IndexedDB is unavailable. */}
    if(stored)project=validate(stored);
    else {const raw=localStorage.getItem(STORAGE_KEY);if(raw)project=validate(JSON.parse(raw));}
    selected=project.start;$('save-status').textContent='Проект загружен';
  }catch(err){$('save-status').textContent='Сохранение не прочитано. Открыт пример.';}
  render();document.querySelector('.workspace').inert=false;$('play').disabled=false;
}
initialize();

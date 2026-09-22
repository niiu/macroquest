'use strict';
let characterUpload=null,dragCharacter=null;
function addActor(id,x=.5,y=.85){
  if(!scene().image){$('character-status').textContent='Сначала загрузите фон сцены.';return;}
  scene().actors??=[];if(scene().actors.length>=100)return;
  scene().actors.push({character:id,x,y,width:.25});$('move-actors').checked=true;save();renderCharacters();
}
function renderActorLayers(){
  QuestLayers.actors($('editor-actors'),scene(),project.characters||[]);
  $('image-surface').classList.toggle('moving-actors',$('move-actors').checked);
  [...$('editor-actors').children].forEach((img,i)=>{
    img.onpointerdown=e=>{
      if(e.button!==0||!$('move-actors').checked)return;e.preventDefault();
      const owner=scene(),placement=owner.actors[i],old={x:placement.x,y:placement.y},r=$('image-surface').getBoundingClientRect(),sx=e.clientX,sy=e.clientY;
      img.setPointerCapture(e.pointerId);
      img.onpointermove=ev=>{placement.x=Math.max(0,Math.min(1,old.x+(ev.clientX-sx)/r.width));placement.y=Math.max(0,Math.min(1,old.y+(ev.clientY-sy)/r.height));img.style.left=placement.x*100+'%';img.style.top=placement.y*100+'%';};
      const end=ev=>{img.onpointermove=img.onpointerup=img.onpointercancel=null;if(img.hasPointerCapture(e.pointerId))img.releasePointerCapture(e.pointerId);if(ev.type==='pointercancel')Object.assign(placement,old);else save();renderActorLayers();};
      img.onpointerup=end;img.onpointercancel=end;
    };
  });
}
function renderCharacters(){
  $('character-list').replaceChildren();$('actor-list').replaceChildren();
  for(const character of project.characters||[]){
    const card=el('div','character-card'),image=el('img');image.src=character.image;image.alt=character.name;image.draggable=false;
    const name=el('input');name.value=character.name;name.maxLength=100;name.setAttribute('aria-label','Имя персонажа: '+character.name);
    name.oninput=()=>{const next=name.value.trim();if(next&&next!==character.name){character.name=next;save();}};
    name.onchange=()=>{name.oninput();renderCharacters();};
    const change=el('button','','Картинка');change.onclick=()=>{characterUpload=character;$('character-file').click();};
    const add=el('button','','+ На сцену');add.disabled=!scene().image;add.onclick=()=>addActor(character.id);
    const remove=el('button','quiet','Удалить персонажа');remove.onclick=()=>{if(project.scenes.some(s=>s.actors?.some(p=>p.character===character.id))){$('character-status').textContent='Сначала уберите персонажа со всех сцен.';return;}project.characters=project.characters.filter(c=>c!==character);save();renderCharacters();};
    card.draggable=true;card.ondragstart=e=>{dragCharacter=character.id;e.dataTransfer.setData('text/plain',character.id);e.dataTransfer.effectAllowed='copy';};card.ondragend=()=>{dragCharacter=null;};
    card.append(image,name,change,add,remove);$('character-list').append(card);
  }
  (scene().actors||[]).forEach((placement,index)=>{
    const character=(project.characters||[]).find(c=>c.id===placement.character);if(!character)return;
    const row=el('div','actor-row');row.append(el('span','',`${index+1}. ${character.name}`));
    const label=el('label','','Размер '),size=el('input');size.type='range';size.min='2';size.max='100';size.value=placement.width*100;size.setAttribute('aria-label','Размер слоя '+(index+1));size.oninput=()=>{placement.width=Number(size.value)/100;renderActorLayers();};size.onchange=save;label.append(size);
    const up=el('button','','На передний план');up.disabled=index===scene().actors.length-1;up.onclick=()=>{scene().actors.splice(index,1);scene().actors.push(placement);save();renderCharacters();};
    const remove=el('button','quiet','Убрать со сцены');remove.onclick=()=>{scene().actors.splice(index,1);save();renderCharacters();};
    row.append(label,up,remove);$('actor-list').append(row);
  });
  renderActorLayers();
}
$('move-actors').onchange=renderActorLayers;
$('image-surface').addEventListener('dragover',e=>{if(dragCharacter&&scene().image){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('image-surface').addEventListener('drop',e=>{if(!dragCharacter||!scene().image)return;e.preventDefault();const r=$('image-surface').getBoundingClientRect();addActor(dragCharacter,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)));dragCharacter=null;});
$('add-character').onclick=()=>{characterUpload=null;$('character-file').click();};
$('character-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;const owner=project,existing=characterUpload;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024)throw Error('Нужен PNG, JPG или WebP до 15 МБ.');
    if(!existing&&(project.characters||[]).length>=200)throw Error('Максимум 200 персонажей.');
    const url=URL.createObjectURL(file);let image;try{image=await decodeImage(url);}finally{URL.revokeObjectURL(url);}
    if(project!==owner)return;
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/png');
    if(existing)existing.image=data;else{project.characters??=[];project.characters.push({id:'actor'+crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,'').slice(0,100)||'Персонаж',image:data});}
    save();renderCharacters();$('character-status').textContent='Персонаж готов. Перетащите его на изображение сцены.';
  }catch(error){$('character-status').textContent=error.message;}finally{e.target.value='';}
};

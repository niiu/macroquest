/* Shared scene artwork, character placements and image transition labels. */
(function installSceneLayers(root){
  'use strict';
  const imageValid=s=>typeof s==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
  function pictures(character){return [{id:'default',name:'Основная',image:character.image},...(character.images||[])];}
  function picture(character,id='default'){return pictures(character).find(p=>p.id===id);}
  function validate(project){
    const characters=project.characters||[];
    if(!Array.isArray(characters)||characters.length>200)throw Error('Допускается до 200 персонажей.');
    const ids=new Set();
    for(const c of characters){
      if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||!imageValid(c.image))throw Error('Некорректный персонаж или изображение.');ids.add(c.id);
      if(c.images!==undefined&&(!Array.isArray(c.images)||c.images.length>29))throw Error('Допускается до 30 картинок на персонажа.');
      const imageIds=new Set(['default']);
      for(const p of c.images||[]){if(!p||typeof p.id!=='string'||!p.id||imageIds.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!imageValid(p.image))throw Error('Некорректная картинка персонажа.');imageIds.add(p.id);}
    }
    for(const scene of project.scenes){
      if(scene.actors===undefined)continue;
      if(!Array.isArray(scene.actors)||scene.actors.length>100)throw Error('Допускается до 100 слоёв персонажей на сцене.');
      for(const p of scene.actors)if(!p||!ids.has(p.character)||![p.x,p.y,p.width].every(Number.isFinite)||p.x<0||p.x>1||p.y<0||p.y>1||p.width<.02||p.width>1)throw Error('Некорректное размещение персонажа.');
      for(const p of scene.actors)if(p.imageId!==undefined&&!picture(characters.find(c=>c.id===p.character),p.imageId))throw Error('Слой ссылается на отсутствующую картинку персонажа.');
    }
  }
  function actors(host,scene,characters){
    host.replaceChildren();
    if(!scene.image)return;
    for(const placement of scene.actors||[]){const character=characters.find(c=>c.id===placement.character);if(!character)continue;
      const img=document.createElement('img');img.src=(picture(character,placement.imageId)||picture(character)).image;img.alt=character.name;img.draggable=false;
      img.className='scene-actor';img.style.left=placement.x*100+'%';img.style.top=placement.y*100+'%';img.style.width=placement.width*100+'%';host.append(img);
    }
  }
  const onImage=choice=>(choice.zone||[]).some(s=>s.mode==='paint');
  function anchor(choice){const strokes=(choice.zone||[]).filter(s=>s.mode==='paint');const p=strokes[0]?.points[0]||[.5,.5];return {x:Math.max(.1,Math.min(.9,p[0])),y:Math.max(.08,Math.min(.92,p[1]))};}
  function paths(host,scene,scenes,result,take){
    host.replaceChildren();if(!scene.image)return;
    for(const c of scene.choices){if(!onImage(c))continue;const target=scenes.find(s=>s.id===c.target),r=result(c),p=anchor(c);const destination=c.check?'🎲 D20':target?.title||'Без названия';
      const button=document.createElement('button');button.className='image-path';button.textContent=(r.ok?'':'🔒 ')+c.text+' → '+destination;button.title=c.text+(r.ok?'':' · '+r.reason);button.setAttribute('aria-label',c.text+' → '+destination+(r.ok?'':' · '+r.reason));button.disabled=!r.ok;button.style.left=p.x*100+'%';button.style.top=p.y*100+'%';button.onclick=()=>take(c);host.append(button);
    }
  }
  const css='.actor-layer,.image-paths{position:absolute;inset:0;pointer-events:none}.image-surface .scene-actor{position:absolute;height:auto;transform:translate(-50%,-100%);max-height:100%;object-fit:contain;border-radius:0;pointer-events:none}.image-path{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;max-width:42%;font:12px/1.3 system-ui;padding:7px 10px;background:#1a241ded;color:#e7efd9;border:1px solid #b4c78c;border-radius:6px;overflow-wrap:anywhere}.image-path{opacity:0;pointer-events:none}.image-path:focus-visible{opacity:1;pointer-events:auto}.image-paths{z-index:4}.actor-layer{z-index:1}';
  function hover(host,scene,index){let n=0;scene.choices.forEach((c,i)=>{if(onImage(c)){host.children[n++].style.opacity=i===index?'1':'';}});}
  const api={hover,validate,actors,paths,onImage,anchor,css,pictures,picture};api.standaloneSource=()=>`(${installSceneLayers.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestLayers=api;
})(globalThis);

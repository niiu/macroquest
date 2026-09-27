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
      if(scene.speaker!==undefined&&(typeof scene.speaker!=='string'||scene.speaker.length>100))throw Error('Некорректное имя собеседника.');
      if(scene.dialogue!==undefined&&typeof scene.dialogue!=='boolean')throw Error('Некорректный тип диалоговой сцены.');
      if(scene.actors===undefined)continue;
      if(!Array.isArray(scene.actors)||scene.actors.length>100)throw Error('Допускается до 100 слоёв персонажей на сцене.');
      for(const p of scene.actors)if(!p||!ids.has(p.character)||![p.x,p.y,p.width].every(Number.isFinite)||p.x<0||p.x>1||p.y<0||p.y>1||p.width<.02||p.width>1)throw Error('Некорректное размещение персонажа.');
      for(const p of scene.actors)if(p.imageId!==undefined&&!picture(characters.find(c=>c.id===p.character),p.imageId))throw Error('Слой ссылается на отсутствующую картинку персонажа.');
      for(const p of scene.actors)if(p.dialogue!==undefined&&!project.scenes.some(s=>s.id===p.dialogue&&s.dialogue))throw Error('Персонаж ссылается на отсутствующую реплику диалога.');
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
  // Both players use this conversation controller; effects go through the normal rules engine.
  function conversations(host,scene,quest,{getState,apply,travel,refresh,autoHost}){
    const panels=new Set();
    const dispose=()=>{for(const panel of panels)panel.remove();panels.clear();};
    const finish=()=>{dispose();refresh();};
    const start=(initialId,name,automatic=false)=>{
        const panel=document.createElement(automatic?'section':'dialog');panels.add(panel);panel.className='conversation'+(automatic?' conversation-inline':'');panel.setAttribute('aria-label','Диалог: '+name);if(automatic){autoHost.replaceChildren();autoHost.append(panel);}else document.body.append(panel);
        panel.addEventListener('cancel',e=>{e.preventDefault();finish();});
        const show=(id,message='')=>{
          const node=quest.scenes.find(s=>s.id===id);if(!node){finish();return;}
          panel.replaceChildren();
          const heading=document.createElement('h2');heading.textContent=node.speaker||name||node.title;
          const text=document.createElement('p');text.className='conversation-text';text.textContent=node.text;panel.append(heading,text);
          if(message){const result=document.createElement('p');result.textContent=message;result.setAttribute('role','status');panel.append(result);}
          for(const choice of node.choices){
            const availability=root.QuestRules.transition(choice,quest.variables||[],getState());
            const button=document.createElement('button');button.className='conversation-answer';button.textContent=choice.text+(choice.check?' · 🎲 D20':'');button.disabled=!availability.ok;panel.append(button);
            if(!availability.ok){const reason=document.createElement('small');reason.textContent=availability.reason;panel.append(reason);}
            button.onclick=()=>{const next=root.QuestRules.resolve(choice,quest.variables||[],getState());if(!next.ok)return;apply(next.state);const target=quest.scenes.find(s=>s.id===next.target);if(target?.dialogue&&!automatic)show(target.id,next.roll?.message||'');else{dispose();travel(next.target||scene.id,next.roll?.message||'');}};
          }
          if(!automatic){const close=document.createElement('button');close.className='conversation-exit';close.textContent='Завершить разговор';close.onclick=finish;panel.append(close);}else if(!node.choices.length){const end=document.createElement('p');end.textContent='Разговор окончен';panel.append(end);}heading.tabIndex=-1;heading.focus();
        };
        if(!automatic)panel.showModal();show(initialId);
    };
    if(scene.dialogue&&autoHost)start(scene.id,scene.speaker||scene.title,true);
    [...host.children].forEach((img,index)=>{
      const placement=scene.actors[index];if(!placement?.dialogue)return;
      img.classList.add('talkable');img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Поговорить: '+img.alt);img.title='Поговорить: '+img.alt;
      img.onclick=()=>start(placement.dialogue,img.alt);img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();start(placement.dialogue,img.alt);}};
    });
    return dispose;
  }
  const conversationCSS='.actor-layer:has(.talkable){z-index:5}.image-surface .scene-actor.talkable{pointer-events:auto;cursor:pointer}.talkable:hover,.talkable:focus-visible{filter:drop-shadow(0 0 7px #d8e5a0);outline:2px solid #c9dc91}.conversation{box-sizing:border-box;width:min(620px,92vw);max-height:85vh;overflow:auto;background:#1d251b;color:#e5e8dc;border:1px solid #8b9d68;border-radius:12px;padding:24px}.conversation::backdrop{background:#0009}.conversation-text{white-space:pre-wrap;line-height:1.6}.conversation-answer{display:block;width:100%;text-align:left;margin:10px 0}.conversation-exit{margin-top:22px}.conversation small{display:block}.conversation-inline{width:100%;max-height:none;margin:16px 0;overflow:visible}.conversation-inline h2{font-size:22px;margin-top:0}';
  const api={conversations,conversationCSS,hover,validate,actors,paths,onImage,anchor,css:css+conversationCSS,pictures,picture};api.standaloneSource=()=>`(${installSceneLayers.toString()})(globalThis);`;
  if(typeof module!=='undefined')module.exports=api;else root.QuestLayers=api;
})(globalThis);

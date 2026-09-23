'use strict';
const graphViewport=$('graph-viewport'),graphFrame=el('div','graph-frame');
graphViewport.before(graphFrame);graphFrame.append(graphViewport);
const expansionButtons=[];
for(const [direction,label] of [['left','←'],['right','→'],['up','↑'],['down','↓']]){
  const button=el('button','expand-area expand-'+direction,label+' +');button.setAttribute('aria-label',({left:'Расширить поле влево',right:'Расширить поле вправо',up:'Расширить поле вверх',down:'Расширить поле вниз'})[direction]);button.title=button.getAttribute('aria-label')+' · '+QuestGraphArea.STEP+' px';
  button.onclick=()=>{
    cancelConnection();const result=QuestGraphArea.expand(project,direction,nodeHeight);if(!result.amount)return;
    const x=graphViewport.scrollLeft+result.dx*zoom,y=graphViewport.scrollTop+result.dy*zoom;
    save();renderGraph();
    graphViewport.scrollLeft=direction==='left'?0:direction==='right'?graphViewport.scrollWidth:x;
    graphViewport.scrollTop=direction==='up'?0:direction==='down'?graphViewport.scrollHeight:y;
    $('graph-status').textContent='Добавлена область поля. Новая сцена появится в видимой части.';requestMinimap();
  };graphFrame.append(button);expansionButtons.push({button,direction});
}
const mapPanel=el('div','graph-map-panel'),mapCanvas=el('canvas','graph-minimap'),mapCaption=el('span','','Карта · клик или перетаскивание');
mapCanvas.width=220;mapCanvas.height=110;mapCanvas.tabIndex=0;mapCanvas.setAttribute('aria-label','Карта графа. Клик для перехода, стрелки для прокрутки.');
mapPanel.append(mapCanvas,mapCaption);document.querySelector('.canvas-footer').append(mapPanel);
let minimapFrame=0;
function requestMinimap(){if(!minimapFrame)minimapFrame=requestAnimationFrame(()=>{minimapFrame=0;drawMinimap();});}
function mapTransform(){const size={width:parseFloat($('graph').style.width)||1000,height:parseFloat($('graph').style.height)||780},scale=Math.min(220/size.width,110/size.height);return {...size,scale,x:(220-size.width*scale)/2,y:(110-size.height*scale)/2};}
function drawMinimap(){
  const ctx=mapCanvas.getContext('2d'),m=mapTransform();ctx.clearRect(0,0,220,110);ctx.fillStyle='#11180f';ctx.fillRect(m.x,m.y,m.width*m.scale,m.height*m.scale);
  for(const s of project.scenes){ctx.fillStyle=s.id===selected?'#d7e89e':'#819768';ctx.fillRect(m.x+s.x*m.scale,m.y+s.y*m.scale,Math.max(2,220*m.scale),Math.max(2,154*m.scale));}
  ctx.strokeStyle='#f3e3b0';ctx.lineWidth=1;ctx.fillStyle='#d5e6a422';
  const x=m.x+graphViewport.scrollLeft/zoom*m.scale,y=m.y+graphViewport.scrollTop/zoom*m.scale,w=Math.min(m.width,graphViewport.clientWidth/zoom)*m.scale,h=Math.min(m.height,graphViewport.clientHeight/zoom)*m.scale;
  ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
  for(const {button,direction} of expansionButtons)button.disabled=(['left','right'].includes(direction)?m.width:m.height)>=QuestGraphArea.MAX;
  mapCaption.textContent=`${Math.round(m.width)} × ${Math.round(m.height)} · Карта`;
}
function navigateMap(e){const r=mapCanvas.getBoundingClientRect(),m=mapTransform();graphViewport.scrollLeft=((e.clientX-r.left)*220/r.width-m.x)/m.scale*zoom-graphViewport.clientWidth/2;graphViewport.scrollTop=((e.clientY-r.top)*110/r.height-m.y)/m.scale*zoom-graphViewport.clientHeight/2;requestMinimap();}
mapCanvas.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();mapCanvas.focus();mapCanvas.setPointerCapture(e.pointerId);navigateMap(e);};
mapCanvas.onpointermove=e=>{if(mapCanvas.hasPointerCapture(e.pointerId))navigateMap(e);};
mapCanvas.onpointerup=mapCanvas.onpointercancel=e=>{if(mapCanvas.hasPointerCapture(e.pointerId))mapCanvas.releasePointerCapture(e.pointerId);};
mapCanvas.onkeydown=e=>{const deltas={ArrowLeft:[-300,0],ArrowRight:[300,0],ArrowUp:[0,-300],ArrowDown:[0,300]};if(!deltas[e.key])return;e.preventDefault();graphViewport.scrollLeft+=deltas[e.key][0];graphViewport.scrollTop+=deltas[e.key][1];};
graphViewport.addEventListener('scroll',requestMinimap,{passive:true});new ResizeObserver(requestMinimap).observe(graphViewport);

(function(root){
  'use strict';
  const STEP=1200,MAX=100000;
  function valid(size){return size&&Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>=1000&&size.height>=780&&size.width<=MAX&&size.height<=MAX;}
  function bounds(project,height=()=>154){
    return {width:Math.min(MAX,Math.max(project.graphSize?.width||1000,...project.scenes.map(s=>s.x+340))),height:Math.min(MAX,Math.max(project.graphSize?.height||780,...project.scenes.map(s=>s.y+height(s)+120)))};
  }
  function expand(project,direction,height){
    if(!['left','right','up','down'].includes(direction))throw Error('Неизвестное направление');
    const size=bounds(project,height),horizontal=['left','right'].includes(direction),axis=horizontal?'width':'height',amount=Math.min(STEP,MAX-size[axis]);
    if(!amount)return {amount:0,dx:0,dy:0};
    const dx=direction==='left'?amount:0,dy=direction==='up'?amount:0;
    for(const scene of project.scenes){scene.x+=dx;scene.y+=dy;}
    size[axis]+=amount;project.graphSize=size;return {amount,dx,dy};
  }
  function position(size,x,y,height=154){return {x:Math.max(20,Math.min(size.width-340,x)),y:Math.max(55,Math.min(size.height-height-120,y))};}
  const api={STEP,MAX,valid,bounds,expand,position};
  if(typeof module!=='undefined')module.exports=api;else root.QuestGraphArea=api;
})(globalThis);

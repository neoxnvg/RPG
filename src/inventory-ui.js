import {ITEMS,SLOT_NAMES} from './items.js';
import {itemArt} from './item-art.js';

const rarityNames={common:'Comum',rare:'Raro',epic:'Épico',legendary:'Lendário'};
const slotArt={weapon:'sword',helm:'helm',armor:'armor',wings:'wings',boots:'boots',ring:'ring'};
const format=value=>Number(value).toLocaleString('pt-BR');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const title=item=>ITEMS[item.type].name+(item.level?` +${item.level}`:'');
const attack=item=>item?(ITEMS[item.type].attack||0)+(ITEMS[item.type].attack?item.level*2:0):0;
const defense=item=>item?(ITEMS[item.type].defense||0)+(ITEMS[item.type].defense?item.level:0):0;

export function mountInventory({model,getGold,getLevel=()=>1,onAction}) {
 const panel=document.querySelector('#inventory-panel');
 const find=selector=>panel.querySelector(selector);
 const scrollArea=document.createElement('div');
 scrollArea.className='inventory-scroll-area';
 panel.insertBefore(scrollArea,find('#inventory-stats'));
 for(const selector of ['#inventory-stats','.paperdoll','.bag-heading','#bag-grid'])scrollArea.append(find(selector));
 let selected=null,dragged=null;
 const equipped=item=>Object.values(model.equipment).some(value=>value.uid===item.uid);
 const primary=item=>ITEMS[item.type].slot?(equipped(item)?'unequip':'equip'):ITEMS[item.type].kind==='consumable'?'use':null;
 const primaryNames={equip:'Equipar',unequip:'Retirar',use:'Usar'};

 function icon(item,extra='') {
  const definition=ITEMS[item.type],action=primary(item);
  return `<button class="item-icon ${definition.rarity}${item.uid===selected?' item-selected':''}" data-item="${item.uid}" draggable="true" aria-pressed="${item.uid===selected}" aria-label="${escape(title(item))} · ${rarityNames[definition.rarity]}${equipped(item)?' · Equipado':''}" title="${escape(title(item))}${action?` · Botão direito: ${primaryNames[action].toLowerCase()}`:''}" ${extra}>${itemArt(definition.icon)}${item.count>1?`<b class="item-count">${item.count}</b>`:''}${item.level?`<b class="item-level">+${item.level}</b>`:''}</button>`;
 }

 function comparison(item) {
  const definition=ITEMS[item.type];
  if(!definition.slot||equipped(item))return '';
  const current=model.equipment[definition.slot],deltas=[['Ataque',attack(item)-attack(current)],['Defesa',defense(item)-defense(current)],['Movimento',(definition.speed||0)-(current?ITEMS[current.type].speed||0:0)]];
  return deltas.filter(([,value])=>value!==0).map(([name,value])=>`<span class="item-compare ${value>0?'is-better':'is-worse'}">${value>0?'↑':'↓'} ${Math.abs(value).toLocaleString('pt-BR')} ${name.toLowerCase()}</span>`).join('');
 }

 function renderDetails() {
  const item=model.item(selected),details=find('#item-details');
  if(!item) {
   selected=null;
   details.innerHTML='<div class="item-empty"><span>◇</span><div><strong>Escolha um item</strong><p>Veja seus atributos e equipe com um clique.</p></div></div>';
   return;
  }
  const definition=ITEMS[item.type],isEquipped=equipped(item),action=primary(item),upgradeCost=30*(item.level+1),jewels=model.count('jewel');
  const canUpgrade=item.level<9&&getGold()>=upgradeCost&&jewels>0;
  const affixes=[...(definition.attack?[['Ataque',`+${attack(item)}`]]:[]),...(definition.defense?[['Defesa',`+${defense(item)}`]]:[]),...(definition.speed?[['Movimento',`+${definition.speed.toLocaleString('pt-BR')}`]]:[]),...(definition.restore?[[item.type==='health'?'Restaura vida':'Restaura mana',`+${definition.restore}`]]:[])];
  const upgradeReason=item.level>=9?'Nível máximo +9':jewels<1?'Precisa de uma Joia da Evolução':getGold()<upgradeCost?`Precisa de ${format(upgradeCost)} Zen`:`${format(upgradeCost)} Zen e uma Joia da Evolução`;
  details.innerHTML=`<div class="item-description"><div class="detail-icon ${definition.rarity}">${itemArt(definition.icon)}</div><div class="item-identity"><div class="item-category"><small class="rarity-${definition.rarity}">${rarityNames[definition.rarity]}${definition.slot?` · ${SLOT_NAMES[definition.slot]}`:''}</small>${isEquipped?'<span class="equipped-badge">EQUIPADO</span>':''}</div><h3>${title(item)}</h3>${affixes.length?`<dl class="item-affixes">${affixes.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`:'<p class="material-description">Material para aprimorar seus equipamentos.</p>'}<div class="item-comparison">${comparison(item)}</div></div></div><div class="item-actions">${action?`<button class="item-primary-action" data-action="${action}"><span>${primaryNames[action]}</span><span aria-hidden="true">${action==='equip'?'↗':action==='unequip'?'↙':'✦'}</span></button>`:'<p class="item-material-tip">Selecione um equipamento para usar esta joia.</p>'}<div class="inventory-secondary-actions">${definition.slot?`<button data-action="upgrade" title="${upgradeReason}" ${canUpgrade?'':'disabled'}><span>${item.level>=9?'Melhoria máxima':'Aprimorar +1'}</span><small>${item.level>=9?'+9':`${format(upgradeCost)} Zen · 1 joia`}</small></button>`:''}${!isEquipped?`<button data-action="sell" title="Vender uma unidade por ${definition.value} Zen"><span>Vender${item.count>1?' 1 unidade':''}</span><small>+${format(definition.value)} Zen</small></button>`:''}</div></div>`;
 }

 function render() {
  const focused=document.activeElement,focusItem=focused?.dataset?.item,focusAction=focused?.dataset?.action;
  if(!model.item(selected))selected=null;
  find('#inventory-gold').innerHTML=`<span class="zen-symbol" aria-hidden="true">◈</span> ${format(getGold())} <small>ZEN</small>`;
  const stats=model.stats();
  find('#inventory-stats').innerHTML=`<div class="inventory-stat"><span>Ataque</span><b>${format(10+stats.attack+(getLevel()-1)*2)}</b></div><div class="inventory-stat"><span>Defesa</span><b>${format(stats.defense)}</b></div><div class="inventory-stat"><span>Movimento</span><b>${(6+stats.speed).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</b></div>`;
  const gear=Object.entries(SLOT_NAMES);
  find('#equipment-slots').innerHTML=`<div class="equipment-heading"><span>EQUIPAMENTO</span><small>${gear.filter(([slot])=>model.equipment[slot]).length} / ${gear.length}</small></div>`+gear.map(([slot,name])=>`<div class="gear-slot slot-${slot}${model.equipment[slot]?' is-equipped':''}" data-slot="${slot}" role="group" aria-label="${name}"><small>${name}</small>${model.equipment[slot]?icon(model.equipment[slot]):`<span class="empty-slot" title="Sem ${name.toLowerCase()}">${itemArt(slotArt[slot])}</span>`}</div>`).join('');
  const used=model.bag.reduce((total,item)=>total+ITEMS[item.type].w*ITEMS[item.type].h,0),heading=find('.bag-heading>span');
  if(heading)heading.innerHTML=`MOCHILA <small>${48-used} espaços livres</small>`;
  find('#bag-grid').setAttribute('aria-label','Mochila de itens, oito colunas por seis linhas');
  find('#bag-grid').innerHTML=Array.from({length:48},(_,index)=>`<div class="bag-cell" data-cell="${index}" aria-hidden="true" style="grid-area:${Math.floor(index/8)+1}/${index%8+1}"></div>`).join('')+model.bag.map(item=>icon(item,`style="grid-area:${item.y+1}/${item.x+1}/span ${ITEMS[item.type].h}/span ${ITEMS[item.type].w}"`)).join('');
  renderDetails();
  if(focusItem)find(`[data-item="${focusItem}"]`)?.focus({preventScroll:true});
  else if(focusAction)find(`[data-action="${focusAction}"]:not(:disabled)`)?.focus({preventScroll:true});
 }

 function bagPoint(event) {
  if(!event.target.closest('#bag-grid'))return null;
  const box=find('#bag-grid').getBoundingClientRect();
  return {x:Math.max(0,Math.min(7,Math.floor((event.clientX-box.left)/box.width*8))),y:Math.max(0,Math.min(5,Math.floor((event.clientY-box.top)/box.height*6)))};
 }
 function canPlace(item,point) {
  const definition=ITEMS[item.type];
  return point.x+definition.w<=8&&point.y+definition.h<=6&&!model.bag.some(other=>other.uid!==item.uid&&point.x<other.x+ITEMS[other.type].w&&point.x+definition.w>other.x&&point.y<other.y+ITEMS[other.type].h&&point.y+definition.h>other.y);
 }
 function clearDropPreview() {
  for(const target of panel.querySelectorAll('.drop-valid,.drop-invalid'))target.classList.remove('drop-valid','drop-invalid');
 }
 function finishDrag() {
  dragged=null;panel.classList.remove('inventory-dragging');panel.removeAttribute('data-drag-slot');clearDropPreview();
 }
 panel.addEventListener('click',event=>{
  const item=event.target.closest('[data-item]');
  if(item){selected=item.dataset.item;render();return;}
  const action=event.target.closest('[data-action]');
  if(action&&!action.disabled&&selected){onAction(action.dataset.action,selected);render();}
 });
 panel.addEventListener('contextmenu',event=>{
  const button=event.target.closest('[data-item]');
  if(!button)return;
  event.preventDefault();selected=button.dataset.item;
  const item=model.item(selected),action=item&&primary(item);
  if(action)onAction(action,selected);
  render();
 });
 panel.addEventListener('dragstart',event=>{
  const button=event.target.closest('[data-item]');
  if(!button)return;
  dragged=button.dataset.item;selected=dragged;
  event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';
  panel.classList.add('inventory-dragging');panel.dataset.dragSlot=ITEMS[model.item(dragged).type].slot||'';
 });
 panel.addEventListener('dragover',event=>{
  const item=model.item(dragged);if(!item)return;
  clearDropPreview();const slot=event.target.closest('[data-slot]'),point=bagPoint(event);
  if(slot){event.preventDefault();const valid=ITEMS[item.type].slot===slot.dataset.slot;slot.classList.add(valid?'drop-valid':'drop-invalid');event.dataTransfer.dropEffect=valid?'move':'none';}
  else if(point){event.preventDefault();const valid=canPlace(item,point),definition=ITEMS[item.type];event.dataTransfer.dropEffect=valid?'move':'none';for(let y=point.y;y<Math.min(6,point.y+definition.h);y++)for(let x=point.x;x<Math.min(8,point.x+definition.w);x++)find(`[data-cell="${y*8+x}"]`)?.classList.add(valid?'drop-valid':'drop-invalid');}
 });
 panel.addEventListener('dragend',finishDrag);
 panel.addEventListener('drop',event=>{
  event.preventDefault();const uid=event.dataTransfer.getData('text/plain'),item=model.item(uid);if(!item){finishDrag();return;}
  selected=uid;const slot=event.target.closest('[data-slot]'),point=bagPoint(event);
  if(slot){if(ITEMS[item.type].slot===slot.dataset.slot&&!equipped(item))onAction('equip',uid);}
  else if(point){if(equipped(item)&&canPlace(item,point))onAction('unequip',uid);if(!equipped(item))onAction('move',uid,point);}
  finishDrag();render();
 });
 const note=find('.panel-note');
 if(note)note.innerHTML='Botão direito: equipar ou usar <span>·</span> Arraste para organizar';
 return {render,get selected(){return selected;}};
}

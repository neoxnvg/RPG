import {ITEMS,SLOT_NAMES} from './items.js';
import {itemArt} from './item-art.js';
const rarityNames={common:'Comum',rare:'Raro',epic:'Épico',legendary:'Lendário'};
export function mountInventory({model,getGold,getLevel=()=>1,onAction}){
 const panel=document.querySelector('#inventory-panel');let selected=null;
 const title=i=>ITEMS[i.type].name+(i.level?` +${i.level}`:'');
 function icon(i,extra=''){const d=ITEMS[i.type];return `<button class="item-icon ${d.rarity}" data-item="${i.uid}" draggable="true" title="${title(i)}" ${extra}>${itemArt(d.icon)}${i.count>1?`<b class="item-count">${i.count}</b>`:''}${i.level?`<b class="item-level">+${i.level}</b>`:''}</button>`;}
 function render(){
  document.querySelector('#inventory-gold').textContent=getGold().toLocaleString('pt-BR')+' Zen';const stats=model.stats();document.querySelector('#inventory-stats').innerHTML=`<span>Ataque <b>${10+stats.attack+(getLevel()-1)*2}</b></span><span>Defesa <b>${stats.defense}</b></span><span>Movimento <b>${(6+stats.speed).toFixed(1)}</b></span>`;
  document.querySelector('#equipment-slots').innerHTML=Object.entries(SLOT_NAMES).map(([slot,name])=>`<div class="gear-slot slot-${slot}" data-slot="${slot}"><small>${name}</small>${model.equipment[slot]?icon(model.equipment[slot]):`<span class="empty-slot">${itemArt(slot==='weapon'?'sword':slot==='armor'?'armor':slot==='boots'?'boots':slot==='helm'?'helm':slot==='wings'?'wings':'ring')}</span>`}</div>`).join('');
  document.querySelector('#bag-grid').innerHTML=Array.from({length:48},(_,i)=>`<div class="bag-cell" data-cell="${i}" style="grid-area:${Math.floor(i/8)+1}/${i%8+1}"></div>`).join('')+model.bag.map(i=>icon(i,`style="grid-area:${i.y+1}/${i.x+1}/span ${ITEMS[i.type].h}/span ${ITEMS[i.type].w}"`)).join('');
  const chosen=model.item(selected),details=document.querySelector('#item-details');
  if(!chosen){selected=null;details.innerHTML='<div class="item-empty"><span>◇</span><p>Selecione um item para ver os atributos.<br>Arraste para equipar ou organizar.</p></div>';return;}
  const d=ITEMS[chosen.type],equipped=Object.values(model.equipment).some(i=>i.uid===chosen.uid);details.innerHTML=`<div class="item-description"><div class="detail-icon ${d.rarity}">${itemArt(d.icon)}</div><div><small class="rarity-${d.rarity}">${rarityNames[d.rarity]}${equipped?' · Equipado':''}</small><h3>${title(chosen)}</h3><p>${d.attack?`Ataque +${d.attack+chosen.level*2} · `:''}${d.defense?`Defesa +${d.defense+chosen.level} · `:''}${d.speed?`Velocidade +${d.speed} · `:''}${d.restore?`Restaura ${d.restore} ${chosen.type==='health'?'de vida':'de mana'}`:''}${d.kind==='jewel'?'Material para aprimorar equipamentos':''}</p></div></div><div class="item-actions">${d.slot?`<button data-action="${equipped?'unequip':'equip'}">${equipped?'Retirar':'Equipar'}</button><button data-action="upgrade" ${chosen.level>=9?'disabled':''}>Aprimorar · ${30*(chosen.level+1)} Zen + joia</button>`:d.kind==='consumable'?'<button data-action="use">Usar</button>':''}${!equipped?`<button data-action="sell">Vender · ${d.value} Zen</button>`:''}</div>`;
  for(const button of panel.querySelectorAll('[data-item]'))button.classList.toggle('item-selected',button.dataset.item===selected);
 }
 panel.addEventListener('click',event=>{const item=event.target.closest('[data-item]');if(item){selected=item.dataset.item;render();return;}const action=event.target.closest('[data-action]');if(action&&selected){onAction(action.dataset.action,selected);render();}});
 panel.addEventListener('dragstart',event=>{const item=event.target.closest('[data-item]');if(item){event.dataTransfer.setData('text/plain',item.dataset.item);selected=item.dataset.item;}});
 panel.addEventListener('dragover',event=>{if(event.target.closest('[data-slot],[data-cell]'))event.preventDefault();});
 panel.addEventListener('drop',event=>{event.preventDefault();const uid=event.dataTransfer.getData('text/plain'),item=model.item(uid);if(!item)return;const slot=event.target.closest('[data-slot]'),cell=event.target.closest('[data-cell]');if(slot){if(ITEMS[item.type].slot===slot.dataset.slot)onAction('equip',uid);}else if(cell){const i=Number(cell.dataset.cell);onAction('move',uid,{x:i%8,y:Math.floor(i/8)});}render();});
 return {render,get selected(){return selected;}};
}

import {describeLGQR} from '../../../shared/models/lg-label.mjs';

export function createLGQRDetails(raw){
  const {qr,rows}=describeLGQR(raw),section=document.createElement('section');
  section.className='lg-qr-standard';
  const heading=document.createElement('h3');heading.textContent='Conferência do QR';
  const status=document.createElement('p');status.className='lg-qr-summary '+(qr.valid?'match':'mismatch');
  status.textContent=!qr.text?'Aguardando leitura do QR':qr.valid?'17 caracteres dentro do padrão':'Fora do padrão: '+qr.issues.join('; ');
  section.append(heading,status);
  if(!qr.text)return section;
  const list=document.createElement('div');list.className='lg-qr-checks';
  for(const row of rows){
    const item=document.createElement('div');item.className='lg-qr-check '+(row.valid?'is-valid':'is-invalid');
    const position=document.createElement('span');position.className='lg-qr-position';position.textContent=row.positions;
    const description=document.createElement('div');description.className='lg-qr-description';
    const label=document.createElement('strong');label.textContent=row.label;
    const rule=document.createElement('small');rule.textContent=row.rule;
    description.append(label,rule);
    const reading=document.createElement('div');reading.className='lg-qr-reading';
    const value=document.createElement('code');value.textContent=row.value;
    const state=document.createElement('span');state.textContent=row.valid?'OK':'Revisar';
    reading.append(value,state);
    item.append(position,description,reading);list.append(item);
  }
  section.append(list);
  return section;
}

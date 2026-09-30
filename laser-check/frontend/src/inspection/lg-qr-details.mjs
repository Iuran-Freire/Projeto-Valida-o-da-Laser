import {describeLGQR} from '../../../shared/models/lg-label.mjs';
export function createLGQRDetails(raw){
  const {qr,rows}=describeLGQR(raw),section=document.createElement('section');
  section.className='lg-qr-standard';
  const heading=document.createElement('h3');heading.textContent='Padrão dos caracteres do QR';
  const status=document.createElement('p');status.className=qr.valid?'match':'mismatch';
  status.textContent=!qr.text?'Aguardando leitura do QR':qr.valid?'QR conforme o padrão cadastrado · 17 caracteres':'QR fora do padrão: '+qr.issues.join('; ');
  section.append(heading,status);
  if(!qr.text)return section;
  const wrap=document.createElement('div');wrap.className='table-wrap';
  const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr');
  for(const label of ['Pos.','Significado / padrão','Lido','Situação']){const th=document.createElement('th');th.textContent=label;header.append(th);}head.append(header);table.append(head);
  const body=document.createElement('tbody');
  for(const row of rows){const tr=document.createElement('tr');tr.className=row.valid?'position-ok':'position-error';for(const value of [row.positions,row.label+' · '+row.rule,row.value,row.valid?'OK':'Inválido']){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);section.append(wrap);
  return section;
}

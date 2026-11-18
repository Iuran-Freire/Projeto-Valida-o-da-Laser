// Spreadsheet exports (CSV for Excel in Portuguese: UTF-8 with BOM, ";").
// One line per record, the main columns first, readable words instead of
// internal codes, technical fields left out (they stay in the app details).
import {DEFAULT_MODEL,getModelProfile,SHIFT_LABELS} from '../models/serial-profile.mjs';

const RESULT_LABELS={COINCIDE:'Coincide',DIVERGENTE:'Divergente',PENDENTE:'Pendente'};
const SYNC_LABELS={synced:'Compartilhado',pending:'Aguardando envio'};
const VISUAL_LABELS={clear:'Sem falha visual',defect:'Com falha visual'};

// Text that Excel would turn into a number (losing leading zeros or showing
// long codes as 1,23E+16) is written as ="0123", which Excel keeps as text.
const NUMBER_LIKE=/^(?:\d+|\d+[eE][+-]?\d+)$/;

export function csvCell(value){
 let text=value==null?'':String(value).replace(/\s*[\r\n]+\s*/g,' ').replace(/[ \t]{2,}/g,' ').trim();
 if(NUMBER_LIKE.test(text))text='="'+text+'"';
 else text=text.replace(/^[=+@-]/,mark=>"'"+mark); // a cell never starts a formula
 return '"'+text.replaceAll('"','""')+'"';
}

export const csvDocument=(headings,rows)=>'\ufeff'+[headings,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');

const validDate=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date:null;};
export const localDate=value=>validDate(value)?.toLocaleDateString('pt-BR')||'';
export const localTime=value=>validDate(value)?.toLocaleTimeString('pt-BR')||'';
export const shiftLabel=shift=>Object.prototype.hasOwnProperty.call(SHIFT_LABELS,shift||'')?`${SHIFT_LABELS[shift]} (${shift})`:shift||'';
const yesNo=value=>value?'Sim':'Não';
const list=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' e '+items[items.length-1];

const LASER_HEADINGS=['Data','Hora','Inspetor','Turno','Modelo','Resultado','Série/Part No. no código','Série/Part No. impressa','Motivo','Conferência visual','Confirmado pelo inspetor','Edição manual','Código 2D completo','Código de barras (LG)','Texto impresso lido','Origem do texto impresso','Confiança do OCR','Antes da edição','Sincronização','ID do registro'];

// Laser inspections (tampografia × código 2D).
export function inspectionCsv(records){
 return csvDocument(LASER_HEADINGS,records.map(r=>{
  const edited=[r.codeEdited&&'Código 2D',r.barcodeEdited&&'Código de barras',r.printEdited&&'Texto impresso'].filter(Boolean);
  const before=[r.codeEdited&&'Código 2D: '+(r.originalCode||''),r.barcodeEdited&&'Código de barras: '+(r.originalBarcode||''),r.printEdited&&'Texto: '+(r.originalOCR||'')].filter(Boolean);
  const confidence=Number(r.confidence);
  return [localDate(r.date),localTime(r.date),r.inspector,shiftLabel(r.shift),getModelProfile(r.model||DEFAULT_MODEL).label,
   RESULT_LABELS[r.status]||r.status,r.codeSerial,r.printSerial,r.reason,VISUAL_LABELS[r.visualDecision]||'',yesNo(r.confirmed),
   edited.length?list(edited):'Não',r.qr,r.barcode,r.ocr,r.printSource==='manual'?'Manual':r.printSource,
   confidence>0?Math.round(confidence)+'%':'',before.join(' · '),SYNC_LABELS[r.syncState]||r.syncState,r.id];
 }));
}

const ANATEL_HEADINGS=['Data','Hora','Inspetor','Turno','Modelo','Resultado','Número do modelo','Número no selo','TAB do selo','Código 2D da peça','Motivo','Confirmado pelo inspetor','Número editado manualmente','Sincronização','ID do registro'];

// Selo Anatel stage.
export function anatelCsv(records){
 return csvDocument(ANATEL_HEADINGS,records.map(r=>[localDate(r.date),localTime(r.date),r.inspector,shiftLabel(r.shift),
  getModelProfile(r.model||DEFAULT_MODEL).label,RESULT_LABELS[r.status]||r.status,r.codeSerial,r.printSerial,r.anatelTab,r.qr,
  r.reason,yesNo(r.confirmed),yesNo(r.printEdited),SYNC_LABELS[r.syncState]||r.syncState,r.id]));
}

// File name with the local date (toISOString would give the UTC date, a day ahead at night).
export function csvFileName(prefix,now=new Date()){
 const pad=value=>String(value).padStart(2,'0');
 return `${prefix}-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}.csv`;
}

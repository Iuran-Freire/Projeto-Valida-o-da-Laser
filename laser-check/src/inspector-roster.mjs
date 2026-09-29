import {isShiftCode} from './serial-profile.mjs';

export function normalizeInspectorName(value){
  return String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
}

export function inspectorNameKey(value){
  return normalizeInspectorName(value).toLocaleLowerCase('pt-BR');
}

export function validInspectorEntry(name,shift){
  return name.length>=2&&name.length<=80&&isShiftCode(shift);
}

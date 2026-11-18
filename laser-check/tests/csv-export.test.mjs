import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectionCsv,anatelCsv,csvCell,csvFileName} from '../shared/export/csv-export.mjs';

// Minimal CSV reader (";" and quoted cells) to check the file as a spreadsheet would.
function parse(text){
 assert.ok(text.startsWith('\ufeff'),'BOM para o Excel reconhecer os acentos');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=1;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(char==='"')quoted=false;else cell+=char;}
  else if(char==='"')quoted=true;
  else if(char===';'){row.push(cell);cell='';}
  else if(char==='\r'&&text[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}
  else cell+=char;
 }
 row.push(cell);rows.push(row);return rows;
}

const laser={id:'633b60fb-64fe-42a8-9024-26795201981b',date:'2026-11-18T17:20:42.854Z',inspector:'Ana Souza',shift:'G',model:'15w-ve',
 status:'COINCIDE',reason:'',codeSerial:'R37LB9G58L2IPA',printSerial:'R37LB9G58L2IPA',qr:'GH44-03086A+R37LB9G58L2IPA',barcode:null,
 ocr:'SAIDA:9,0\nV\n1,67\nA\nou\n5.0V=\n2,0A\nNUMERO DE\nSERIE:\nR37LB9G58L2IPA',originalCode:'GH44-03086A+R37LB9G58L2IPA',
 originalOCR:'SAIDA:9,0\nV\n1,67\nA\nou\n5.0V=\n2,0A\nNUMERO DE\nSERIE:\nR37LB9G58L2IPA',printSource:'OCR detalhado · foto',confidence:0,
 codeEdited:false,barcodeEdited:false,printEdited:false,confirmed:true,visualDecision:'clear',rule:'serial-positions-gh44-v4',
 format:'DataMatrix',automatic:false,ocrAttempts:[{text:'muito texto técnico',lines:[{text:'x',poly:[[1,2]]}]}],syncState:'synced'};

test('CSV da laser: uma linha por registro, colunas principais primeiro e valores legíveis',()=>{
 const [headings,row,...rest]=parse(inspectionCsv([laser]));
 assert.equal(rest.length,0);
 assert.deepEqual(headings.slice(0,8),['Data','Hora','Inspetor','Turno','Modelo','Resultado','Série/Part No. no código','Série/Part No. impressa']);
 assert.equal(row.length,headings.length);
 const value=name=>row[headings.indexOf(name)];
 assert.match(value('Data'),/^\d{2}\/\d{2}\/\d{4}$/);assert.match(value('Hora'),/^\d{2}:\d{2}:\d{2}$/);
 assert.equal(value('Turno'),'1º turno (G)');assert.equal(value('Modelo'),'M09020D - 15W VE');assert.equal(value('Resultado'),'Coincide');
 assert.equal(value('Conferência visual'),'Sem falha visual');assert.equal(value('Confirmado pelo inspetor'),'Sim');
 assert.equal(value('Edição manual'),'Não');assert.equal(value('Antes da edição'),'');assert.equal(value('Sincronização'),'Compartilhado');
 assert.equal(value('Texto impresso lido'),'SAIDA:9,0 V 1,67 A ou 5.0V= 2,0A NUMERO DE SERIE: R37LB9G58L2IPA'); // no line breaks inside cells
 assert.equal(value('Confiança do OCR'),'');assert.equal(value('ID do registro'),laser.id);
 const text=inspectionCsv([laser]);
 for(const technical of ['muito texto técnico','Data UTC','serial-positions-gh44-v4','DataMatrix','true','false'])assert.ok(!text.includes(technical),technical);
});

test('CSV da laser mostra o que foi editado e o valor anterior',()=>{
 const edited={...laser,status:'DIVERGENTE',reason:'Posição 12 esperada I, lida 1.',codeEdited:true,originalCode:'GH44-03086A+R37LB9G58L1IPA',printEdited:true,originalOCR:'linha 1\nlinha 2',confidence:93.4,syncState:'pending',visualDecision:'defect'};
 const [headings,row]=parse(inspectionCsv([edited]));const value=name=>row[headings.indexOf(name)];
 assert.equal(value('Resultado'),'Divergente');assert.equal(value('Motivo'),'Posição 12 esperada I, lida 1.');
 assert.equal(value('Edição manual'),'Código 2D e Texto impresso');
 assert.equal(value('Antes da edição'),'Código 2D: GH44-03086A+R37LB9G58L1IPA · Texto: linha 1 linha 2');
 assert.equal(value('Confiança do OCR'),'93%');assert.equal(value('Sincronização'),'Aguardando envio');assert.equal(value('Conferência visual'),'Com falha visual');
});

test('células: fórmulas neutralizadas e códigos numéricos mantidos como texto no Excel',()=>{
 assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
 for(const risky of ['+1','-2','@SUM(A1)'])assert.ok(csvCell(risky).startsWith('"\''),risky);
 assert.equal(csvCell('079329356'),'"=""079329356"""');        // TAB with a leading zero
 assert.equal(csvCell('00123456789012'),'"=""00123456789012"""');  // long code: no 1,23E+13
 assert.equal(csvCell('1E5'),'"=""1E5"""');                    // would become 100000
 assert.equal(csvCell('03340-19-04952'),'"03340-19-04952"');
 assert.equal(csvCell('R37LB9G58L2IPA'),'"R37LB9G58L2IPA"');
 assert.equal(csvCell(null),'""');assert.equal(csvCell('a\r\nb'),'"a b"');
});

test('CSV do selo: colunas do selo, TAB preservado e editado em Sim/Não',()=>{
 const seal={id:'9dc9a2a0-9391-4d9d-966b-5add7d517c64',date:'2026-11-18T17:18:09.674Z',inspector:'Ana Souza',shift:'J',model:'15w-ve',stage:'anatel',
  status:'COINCIDE',reason:'O número de homologação do selo é o do modelo.',codeSerial:'03340-19-04952',printSerial:'03340-19-04952',anatelTab:'079329356',
  qr:'GH44-03086A+R37LBCG5GF2IPA',ocr:'03340-19-04952\nTAB 079329356',printEdited:false,confirmed:true,syncState:'synced'};
 const text=anatelCsv([seal]);const [headings,row]=parse(text);const value=name=>row[headings.indexOf(name)];
 assert.deepEqual(headings.slice(0,9),['Data','Hora','Inspetor','Turno','Modelo','Resultado','Número do modelo','Número no selo','TAB do selo']);
 assert.equal(row.length,headings.length);
 assert.equal(value('Turno'),'3º turno (J)');assert.equal(value('Resultado'),'Coincide');assert.equal(value('Número no selo'),'03340-19-04952');
 assert.equal(value('TAB do selo'),'="079329356"');assert.equal(value('Número editado manualmente'),'Não');assert.equal(value('Confirmado pelo inspetor'),'Sim');
 assert.equal(value('Código 2D da peça'),'GH44-03086A+R37LBCG5GF2IPA');
});

test('nome do arquivo usa a data local',()=>{
 assert.equal(csvFileName('valida-laser',new Date(2026,10,18,23,30)),'valida-laser-2026-11-18.csv');
});
